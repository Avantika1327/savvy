import { Router } from "express";
import bcrypt from "bcryptjs";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  BillingCycle,
  MembershipRole,
  PaymentMethod,
  PaymentStatus,
  PlatformRole,
  Prisma,
  SubscriptionStatus,
  type Subscription,
  TenantStatus,
  TenantModule,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import {
  authenticate,
  requirePlatformSuperAdmin,
} from "../../middleware/auth.middleware.js";
import { effectiveTenantStatus, tenantAccessAllowed } from "./tenant-access.js";
import { withPlatformTransaction } from "../../lib/platform-transaction.js";

export const tenantsRouter = Router();
tenantsRouter.use(authenticate("platform"), requirePlatformSuperAdmin);
const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const emptyStringToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

/**
 * Accepts national Indian numbers or international numbers with a country code.
 * libphonenumber-js validates the actual numbering plan; storing an E.164 key
 * separately makes duplicate detection consistent across spaces/dashes.
 */
const contactPhoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(30)
  .refine((value) => /^[+()\-\s.\d]+$/.test(value), {
    message: "Phone number contains unsupported characters.",
  })
  .transform((value, ctx) => {
    const parsed = parsePhoneNumberFromString(value, "IN");
    if (!parsed || !parsed.isValid()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Enter a valid phone number; include the country code for non-Indian numbers.",
      });
      return z.NEVER;
    }
    return parsed.formatInternational();
  });

function normalizePhoneToE164(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value, "IN");
  return parsed?.isValid() ? parsed.number : null;
}

const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

const WORKSPACE_MODULES = [
  TenantModule.PLANTS,
  TenantModule.DRIVERS,
  TenantModule.CUSTOMERS,
  TenantModule.VENDORS,
  TenantModule.DISTRIBUTORS,
] as const;
const CONFIGURABLE_ROLES = [
  MembershipRole.TENANT_ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.STAFF,
] as const;
const rolePermissionInputSchema = z
  .object({
    role: z.enum(["TENANT_ADMIN", "MANAGER", "STAFF"]),
    module: z.nativeEnum(TenantModule),
    canView: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
  })
  .strict()
  .superRefine((permission, ctx) => {
    if (
      (permission.canCreate || permission.canEdit || permission.canDelete) &&
      !permission.canView
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["canView"],
        message: "Create, edit, and delete permissions require view access.",
      });
    }
  });

const createTenantSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    contactName: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(2).max(120).optional(),
    ),
    contactEmail: z.preprocess(
      emptyStringToUndefined,
      normalizedEmailSchema.optional(),
    ),
    contactPhone: z.preprocess(
      emptyStringToUndefined,
      contactPhoneSchema.optional(),
    ),
    planCode: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]).default("STARTER"),
    priceAmount: z.number().finite().min(0).max(100000000).optional(),
    billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
    ownerName: z.string().trim().min(2).max(120),
    ownerEmail: normalizedEmailSchema,
    ownerPassword: z.string().min(12).max(128),
    trialDays: z.number().int().min(0).max(90).default(14),
    enabledModules: z
      .array(z.nativeEnum(TenantModule))
      .min(1)
      .max(WORKSPACE_MODULES.length)
      .default([...WORKSPACE_MODULES]),
    rolePermissions: z
      .array(rolePermissionInputSchema)
      .max(CONFIGURABLE_ROLES.length * WORKSPACE_MODULES.length)
      .default([]),
  })
  .superRefine((input, ctx) => {
    const enabled = new Set(input.enabledModules);
    if (enabled.size !== input.enabledModules.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enabledModules"],
        message: "A module can only be selected once.",
      });
    }
    const seen = new Set<string>();
    for (const permission of input.rolePermissions) {
      const key = `${permission.role}:${permission.module}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rolePermissions"],
          message: `Duplicate permission settings for ${permission.role} / ${permission.module}.`,
        });
      }
      seen.add(key);
      if (!enabled.has(permission.module)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rolePermissions"],
          message: `Permissions were supplied for disabled module ${permission.module}.`,
        });
      }
    }
    if (input.rolePermissions.length > 0) {
      for (const module of input.enabledModules) {
        for (const role of CONFIGURABLE_ROLES) {
          if (!seen.has(`${role}:${module}`)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["rolePermissions"],
              message: `Missing permission settings for ${role} / ${module}.`,
            });
          }
        }
      }
    }
  });

function buildDefaultRolePermissions(modules: TenantModule[]) {
  return modules.flatMap((module) =>
    CONFIGURABLE_ROLES.map((role) => ({
      role,
      module,
      canView: true,
      canCreate: role !== MembershipRole.STAFF,
      canEdit: role !== MembershipRole.STAFF,
      canDelete: role === MembershipRole.TENANT_ADMIN,
    })),
  );
}

function getPrismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function getPrismaUniqueTarget(error: unknown): string[] {
  if (typeof error !== "object" || error === null || !("meta" in error))
    return [];
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.map(String);
  return typeof target === "string" ? [target] : [];
}

function prismaTargetHas(error: unknown, fragment: string): boolean {
  const expected = fragment.toLowerCase();
  return getPrismaUniqueTarget(error).some((target) =>
    target.toLowerCase().includes(expected),
  );
}

function getErrorBlockers(
  error: unknown,
): Array<{ relation: string; count: number }> | undefined {
  if (typeof error !== "object" || error === null || !("blockers" in error)) {
    return undefined;
  }
  const blockers = (error as { blockers?: unknown }).blockers;
  if (!Array.isArray(blockers)) return undefined;
  return blockers.filter(
    (item): item is { relation: string; count: number } =>
      typeof item === "object" &&
      item !== null &&
      "relation" in item &&
      typeof item.relation === "string" &&
      "count" in item &&
      typeof item.count === "number",
  );
}

function addBillingPeriod(start: Date, cycle: BillingCycle): Date {
  const result = new Date(start);
  const originalDay = result.getDate();
  result.setDate(1);
  if (cycle === BillingCycle.ANNUAL)
    result.setFullYear(result.getFullYear() + 1);
  else result.setMonth(result.getMonth() + 1);
  const finalDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(originalDay, finalDayOfTargetMonth));
  return result;
}

type TenantForSerialization = {
  id: string;
  name: string;
  slug: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: TenantStatus;
  activatedAt: Date | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  subscription?: Subscription | null;
  memberships?: Array<{ user: { name: string; email: string } | null }>;
  _count?: { memberships: number };
};

function serializeTenant(t: TenantForSerialization) {
  const effectiveStatus = effectiveTenantStatus({
    status: t.status,
    subscription: t.subscription ?? null,
  });
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    contactName: t.contactName,
    contactEmail: t.contactEmail,
    contactPhone: t.contactPhone,
    ownerName: t.memberships?.[0]?.user?.name ?? null,
    ownerEmail: t.memberships?.[0]?.user?.email ?? null,
    status: t.status,
    effectiveStatus,
    planCode: t.subscription?.planCode ?? "STARTER",
    subscriptionStatus: t.subscription?.status ?? "PAYMENT_PENDING",
    billingCycle: t.subscription?.billingCycle ?? "MONTHLY",
    priceAmount: t.subscription?.priceAmount?.toString() ?? null,
    currency: t.subscription?.currency ?? "INR",
    createdAt: t.createdAt,
    activatedAt: t.activatedAt,
    deactivatedAt: t.deactivatedAt,
    deletedAt: t.deletedAt,
    trialEndsAt: t.subscription?.trialEndsAt ?? null,
    currentPeriodStartsAt: t.subscription?.currentPeriodStartsAt ?? null,
    currentPeriodEndsAt: t.subscription?.currentPeriodEndsAt ?? null,
    memberCount: t._count?.memberships ?? 0,
  };
}
const includeTenant = {
  _count: { select: { memberships: true } },
  subscription: true,
  memberships: {
    where: { role: MembershipRole.TENANT_OWNER, isActive: true },
    orderBy: { createdAt: "asc" },
    take: 1,
    include: { user: { select: { name: true, email: true } } },
  },
} as const;

tenantsRouter.get("/", async (_req, res, next) => {
  try {
    const [tenants, total, active, suspended, paymentPending, expired] =
      await Promise.all([
        prisma.tenant.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: includeTenant,
        }),
        prisma.tenant.count({ where: { deletedAt: null } }),
        prisma.tenant.count({
          where: { deletedAt: null, status: TenantStatus.ACTIVE },
        }),
        prisma.tenant.count({
          where: { deletedAt: null, status: TenantStatus.SUSPENDED },
        }),
        prisma.tenant.count({
          where: {
            deletedAt: null,
            OR: [
              { status: TenantStatus.PAYMENT_PENDING },
              {
                subscription: {
                  is: {
                    status: {
                      in: [
                        SubscriptionStatus.PAYMENT_PENDING,
                        SubscriptionStatus.PAST_DUE,
                      ],
                    },
                  },
                },
              },
            ],
          },
        }),
        prisma.tenant.count({
          where: {
            deletedAt: null,
            OR: [
              { status: TenantStatus.EXPIRED },
              { subscription: { is: { status: SubscriptionStatus.EXPIRED } } },
            ],
          },
        }),
      ]);
    res.json({
      data: tenants.map(serializeTenant),
      meta: { total, active, suspended, paymentPending, expired },
    });
  } catch (error) {
    next(error);
  }
});

tenantsRouter.post("/", async (req, res, next) => {
  const parsed = createTenantSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid tenant details.",
      },
    });
  const input = parsed.data;
  try {
    const normalizedPhone = normalizePhoneToE164(input.contactPhone);
    const [existingOwner, existingSlug, existingPhone] = await Promise.all([
      prisma.user.findFirst({
        where: { email: { equals: input.ownerEmail, mode: "insensitive" } },
        select: { id: true },
      }),
      prisma.tenant.findFirst({
        where: { slug: { equals: input.slug, mode: "insensitive" } },
        select: { id: true },
      }),
      normalizedPhone
        ? prisma.tenant.findUnique({
            where: { contactPhoneNormalized: normalizedPhone },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (existingOwner) {
      return res.status(409).json({
        error: {
          code: "EMAIL_IN_USE",
          message: "This email already belongs to an account.",
        },
      });
    }
    if (existingSlug) {
      return res.status(409).json({
        error: {
          code: "TENANT_SLUG_IN_USE",
          message: "That workspace slug is already in use.",
        },
      });
    }
    if (existingPhone) {
      return res.status(409).json({
        error: {
          code: "CONTACT_PHONE_IN_USE",
          message:
            "That contact phone number is already assigned to another workspace.",
        },
      });
    }
    const passwordHash = await bcrypt.hash(input.ownerPassword, 12);
    const now = new Date();
    // Trial access is explicit and expires. Zero trial days creates a payment-pending tenant.
    const isTrial = input.trialDays > 0;
    const trialEndsAt = isTrial
      ? new Date(now.getTime() + input.trialDays * 86_400_000)
      : null;
    const tenant = await withPlatformTransaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          contactPhoneNormalized: normalizedPhone,
          status: isTrial ? TenantStatus.TRIAL : TenantStatus.PAYMENT_PENDING,
        },
      });
      const owner = await tx.user.create({
        data: {
          name: input.ownerName,
          email: input.ownerEmail,
          password: passwordHash,
          role: "tenant_admin",
          platformRole: PlatformRole.USER,
        },
      });
      await tx.tenantMembership.create({
        data: {
          tenantId: created.id,
          userId: owner.id,
          role: MembershipRole.TENANT_OWNER,
          isActive: true,
        },
      });
      const subscription = await tx.subscription.create({
        data: {
          tenantId: created.id,
          planCode: input.planCode,
          status: isTrial
            ? SubscriptionStatus.TRIAL
            : SubscriptionStatus.PAYMENT_PENDING,
          billingCycle: input.billingCycle,
          priceAmount:
            input.priceAmount === undefined
              ? undefined
              : new Prisma.Decimal(input.priceAmount),
          startsAt: now,
          trialEndsAt,
        },
      });

      // Store an explicit enabled/disabled entitlement for every supported module.
      await tx.tenantModuleAccess.createMany({
        data: WORKSPACE_MODULES.map((module) => ({
          tenantId: created.id,
          module,
          isEnabled: input.enabledModules.includes(module),
        })),
      });

      // Older API clients can omit the matrix; new Super Admin UI submits it explicitly.
      const rolePermissions =
        input.rolePermissions.length > 0
          ? input.rolePermissions
          : buildDefaultRolePermissions(input.enabledModules);
      await tx.tenantRolePermission.createMany({
        data: rolePermissions.map((permission) => ({
          tenantId: created.id,
          role: permission.role as MembershipRole,
          module: permission.module,
          canView: permission.canView,
          canCreate: permission.canCreate,
          canEdit: permission.canEdit,
          canDelete: permission.canDelete,
        })),
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId: created.id,
          action: "TENANT_CREATED",
          entityType: "Tenant",
          entityId: created.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: {
            slug: created.slug,
            planCode: input.planCode,
            trialDays: input.trialDays,
            enabledModules: input.enabledModules,
            rolePermissionCount:
              input.rolePermissions.length ||
              buildDefaultRolePermissions(input.enabledModules).length,
          },
        },
      });
      return { ...created, subscription };
    });
    res.status(201).json({
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        planCode: tenant.subscription.planCode,
        subscriptionStatus: tenant.subscription.status,
        billingCycle: tenant.subscription.billingCycle,
        ownerEmail: input.ownerEmail,
        trialEndsAt: tenant.subscription.trialEndsAt,
        enabledModules: input.enabledModules,
        rolePermissionCount:
          input.rolePermissions.length ||
          buildDefaultRolePermissions(input.enabledModules).length,
      },
    });
  } catch (error: unknown) {
    if (getPrismaErrorCode(error) === "P2002") {
      if (
        prismaTargetHas(error, "contact_phone_normalized") ||
        prismaTargetHas(error, "contactphonenormalized")
      ) {
        return res.status(409).json({
          error: {
            code: "CONTACT_PHONE_IN_USE",
            message:
              "That contact phone number is already assigned to another workspace.",
          },
        });
      }
      if (prismaTargetHas(error, "slug")) {
        return res.status(409).json({
          error: {
            code: "TENANT_SLUG_IN_USE",
            message: "That workspace slug is already in use.",
          },
        });
      }
      if (prismaTargetHas(error, "email")) {
        return res.status(409).json({
          error: {
            code: "EMAIL_IN_USE",
            message: "This email already belongs to an account.",
          },
        });
      }
      return res.status(409).json({
        error: {
          code: "DUPLICATE_RECORD",
          message: "A unique field already exists.",
        },
      });
    }
    next(error);
  }
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
});
tenantsRouter.patch("/:tenantId/status", async (req, res, next) => {
  const tenantId = req.params.tenantId;
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Status must be ACTIVE, INACTIVE or SUSPENDED.",
      },
    });
  try {
    const current = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });
    if (!current)
      return res.status(404).json({
        error: { code: "TENANT_NOT_FOUND", message: "Tenant not found." },
      });
    if (current.deletedAt) {
      return res.status(409).json({
        error: {
          code: "TENANT_IN_TRASH",
          message: "Restore the tenant before changing its status.",
        },
      });
    }
    const requested = parsed.data.status as TenantStatus;
    const candidateStatus =
      requested === TenantStatus.ACTIVE &&
      current.subscription?.status === SubscriptionStatus.TRIAL
        ? TenantStatus.TRIAL
        : requested;
    const accessStateStatus =
      (current.status === TenantStatus.SUSPENDED ||
        current.status === TenantStatus.INACTIVE) &&
      current.subscription?.status === SubscriptionStatus.TRIAL
        ? TenantStatus.TRIAL
        : current.status;
    if (
      requested === TenantStatus.ACTIVE &&
      !tenantAccessAllowed({
        status: accessStateStatus,
        subscription: current.subscription,
      })
    ) {
      return res.status(409).json({
        error: {
          code: "PAYMENT_OR_SUBSCRIPTION_REQUIRED",
          message:
            "Access cannot be activated without a valid trial or a confirmed, unexpired subscription payment.",
        },
      });
    }
    const now = new Date();
    const tenant = await withPlatformTransaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: candidateStatus,
          activatedAt:
            candidateStatus === TenantStatus.ACTIVE
              ? (current.activatedAt ?? now)
              : undefined,
          deactivatedAt:
            candidateStatus === TenantStatus.SUSPENDED ||
            candidateStatus === TenantStatus.INACTIVE
              ? now
              : null,
        },
        include: { subscription: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: `TENANT_${candidateStatus}`,
          entityType: "Tenant",
          entityId: tenantId,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: {
            previousStatus: current.status,
            requestedStatus: requested,
            newStatus: candidateStatus,
          },
        },
      });
      return updated;
    });
    res.json({
      data: serializeTenant({ ...tenant, _count: { memberships: 0 } }),
    });
  } catch (error: unknown) {
    next(error);
  }
});

const subscriptionSchema = z.object({
  planCode: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]),
  billingCycle: z.nativeEnum(BillingCycle),
  priceAmount: z.number().finite().min(0).max(100000000),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .default("INR"),
});
tenantsRouter.patch("/:tenantId/subscription", async (req, res, next) => {
  const tenantId = req.params.tenantId;
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ?? "Invalid subscription details.",
      },
    });
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, deletedAt: true },
    });
    if (!tenant) {
      return res.status(404).json({
        error: { code: "TENANT_NOT_FOUND", message: "Tenant not found." },
      });
    }
    if (tenant.deletedAt) {
      return res.status(409).json({
        error: {
          code: "TENANT_IN_TRASH",
          message: "Restore the tenant before changing its subscription.",
        },
      });
    }
    const existing = await prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!existing)
      return res.status(404).json({
        error: {
          code: "SUBSCRIPTION_NOT_FOUND",
          message: "Subscription not found.",
        },
      });
    const input = parsed.data;
    const result = await withPlatformTransaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { tenantId },
        data: {
          planCode: input.planCode,
          billingCycle: input.billingCycle,
          priceAmount: new Prisma.Decimal(input.priceAmount),
          currency: input.currency.toUpperCase(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: "SUBSCRIPTION_UPDATED",
          entityType: "Subscription",
          entityId: updated.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: {
            planCode: input.planCode,
            billingCycle: input.billingCycle,
            priceAmount: input.priceAmount,
            currency: input.currency,
          },
        },
      });
      return updated;
    });
    res.json({
      data: {
        tenantId,
        planCode: result.planCode,
        billingCycle: result.billingCycle,
        priceAmount: result.priceAmount?.toString() ?? null,
        currency: result.currency,
        status: result.status,
        currentPeriodEndsAt: result.currentPeriodEndsAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

const paymentSchema = z.object({
  amount: z.number().finite().positive().max(100000000),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .default("INR"),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.MANUAL),
  reference: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(200).optional(),
  ),
  notes: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(2000).optional(),
  ),
});
tenantsRouter.get("/:tenantId/payments", async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.tenantId },
      select: { id: true },
    });
    if (!tenant)
      return res.status(404).json({
        error: { code: "TENANT_NOT_FOUND", message: "Tenant not found." },
      });
    const payments = await withPlatformTransaction((tx) =>
      tx.payment.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true, email: true } },
          confirmedBy: { select: { name: true, email: true } },
        },
      }),
    );
    res.json({
      data: payments.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        currency: p.currency,
        status: p.status,
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        createdAt: p.createdAt,
        confirmedAt: p.confirmedAt,
        createdBy: p.createdBy,
        confirmedBy: p.confirmedBy,
      })),
    });
  } catch (error) {
    next(error);
  }
});
tenantsRouter.post("/:tenantId/payments", async (req, res, next) => {
  const tenantId = req.params.tenantId;
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid payment details.",
      },
    });
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, deletedAt: true },
    });
    if (!tenant) {
      return res.status(404).json({
        error: { code: "TENANT_NOT_FOUND", message: "Tenant not found." },
      });
    }
    if (tenant.deletedAt) {
      return res.status(409).json({
        error: {
          code: "TENANT_IN_TRASH",
          message: "Restore the tenant before recording payments.",
        },
      });
    }
    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub)
      return res.status(404).json({
        error: {
          code: "SUBSCRIPTION_NOT_FOUND",
          message: "Tenant subscription not found.",
        },
      });
    const p = parsed.data;
    if (p.reference) {
      const duplicateReference = await prisma.payment.findFirst({
        where: { tenantId, reference: p.reference },
        select: { id: true },
      });
      if (duplicateReference) {
        return res.status(409).json({
          error: {
            code: "PAYMENT_REFERENCE_IN_USE",
            message:
              "This payment reference has already been recorded for the workspace.",
          },
        });
      }
    }

    const payment = await withPlatformTransaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          tenantId,
          subscriptionId: sub.id,
          amount: new Prisma.Decimal(p.amount),
          currency: p.currency.toUpperCase(),
          method: p.method,
          reference: p.reference,
          notes: p.notes,
          status: PaymentStatus.PENDING,
          createdByUserId: req.auth!.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: "PAYMENT_RECORDED_PENDING",
          entityType: "Payment",
          entityId: created.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: {
            amount: p.amount,
            currency: p.currency,
            method: p.method,
            reference: p.reference,
          },
        },
      });
      return created;
    });
    res.status(201).json({
      data: {
        id: payment.id,
        amount: payment.amount.toString(),
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        reference: payment.reference,
        createdAt: payment.createdAt,
      },
    });
  } catch (error: unknown) {
    if (
      getPrismaErrorCode(error) === "P2002" &&
      prismaTargetHas(error, "reference")
    ) {
      return res.status(409).json({
        error: {
          code: "PAYMENT_REFERENCE_IN_USE",
          message:
            "This payment reference has already been recorded for the workspace.",
        },
      });
    }
    next(error);
  }
});

tenantsRouter.patch(
  "/:tenantId/payments/:paymentId/confirm",
  async (req, res, next) => {
    const { tenantId, paymentId } = req.params;
    const confirmation = z
      .object({ verificationNote: z.string().trim().min(3).max(1000) })
      .safeParse(req.body);
    if (!confirmation.success)
      return res.status(400).json({
        error: {
          code: "VERIFICATION_NOTE_REQUIRED",
          message: "Add a short note explaining how the payment was verified.",
        },
      });
    try {
      const updated = await withPlatformTransaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, deletedAt: true },
        });
        if (!tenant)
          throw Object.assign(new Error("TENANT_NOT_FOUND"), {
            code: "TENANT_NOT_FOUND",
          });
        if (tenant.deletedAt)
          throw Object.assign(new Error("TENANT_IN_TRASH"), {
            code: "TENANT_IN_TRASH",
          });

        const payment = await tx.payment.findFirst({
          where: { id: paymentId, tenantId },
          include: { subscription: true },
        });
        if (!payment)
          throw Object.assign(new Error("PAYMENT_NOT_FOUND"), {
            code: "PAYMENT_NOT_FOUND",
          });
        if (payment.status !== PaymentStatus.PENDING)
          throw Object.assign(new Error("PAYMENT_NOT_PENDING"), {
            code: "PAYMENT_NOT_PENDING",
          });
        if (
          payment.subscription.priceAmount &&
          payment.amount.lessThan(payment.subscription.priceAmount)
        )
          throw Object.assign(new Error("PAYMENT_AMOUNT_INSUFFICIENT"), {
            code: "PAYMENT_AMOUNT_INSUFFICIENT",
          });
        const now = new Date();
        const previousEnd = payment.subscription.currentPeriodEndsAt;
        const periodStart =
          previousEnd && previousEnd > now ? previousEnd : now;
        const periodEnd = addBillingPeriod(
          periodStart,
          payment.subscription.billingCycle,
        );
        const confirmed = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.CONFIRMED,
            confirmedAt: now,
            confirmedByUserId: req.auth!.userId,
            notes: [
              payment.notes,
              `Verification: ${confirmation.data.verificationNote}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        });
        await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStartsAt:
              previousEnd && previousEnd > now
                ? (payment.subscription.currentPeriodStartsAt ?? now)
                : now,
            currentPeriodEndsAt: periodEnd,
            canceledAt: null,
          },
        });
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            status: TenantStatus.ACTIVE,
            activatedAt: now,
            deactivatedAt: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: req.auth!.userId,
            tenantId,
            action: "PAYMENT_CONFIRMED_AND_ACCESS_ACTIVATED",
            entityType: "Payment",
            entityId: payment.id,
            ipAddress: req.ip,
            userAgent: req.get("user-agent")?.slice(0, 500),
            metadata: {
              amount: payment.amount.toString(),
              currency: payment.currency,
              periodEndsAt: periodEnd.toISOString(),
              verificationNote: confirmation.data.verificationNote,
            },
          },
        });
        return { payment: confirmed, currentPeriodEndsAt: periodEnd };
      });
      res.json({
        data: {
          id: updated.payment.id,
          status: updated.payment.status,
          confirmedAt: updated.payment.confirmedAt,
          currentPeriodEndsAt: updated.currentPeriodEndsAt,
        },
      });
    } catch (error: unknown) {
      const code = getPrismaErrorCode(error);
      const messages: Record<string, string> = {
        PAYMENT_NOT_FOUND: "Payment not found for this tenant.",
        PAYMENT_NOT_PENDING: "Only pending payments can be confirmed.",
        PAYMENT_AMOUNT_INSUFFICIENT:
          "Payment amount is less than the assigned subscription price.",
        TENANT_NOT_FOUND: "Tenant not found.",
        TENANT_IN_TRASH:
          "Restore the tenant before confirming payment or activating access.",
      };
      if (code && Object.prototype.hasOwnProperty.call(messages, code)) {
        const statusCode =
          code === "PAYMENT_NOT_FOUND" || code === "TENANT_NOT_FOUND"
            ? 404
            : 409;
        return res
          .status(statusCode)
          .json({ error: { code, message: messages[code] } });
      }
      next(error);
    }
  },
);

tenantsRouter.get("/:tenantId/audit-logs", async (req, res, next) => {
  try {
    const rows = await withPlatformTransaction((tx) =>
      tx.auditLog.findMany({
        where: { tenantId: req.params.tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { actor: { select: { name: true, email: true } } },
      }),
    );
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        metadata: r.metadata,
        createdAt: r.createdAt,
        ipAddress: r.ipAddress,
        actor: r.actor,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const permanentDeleteSchema = z.object({
  confirmSlug: z.string().trim().toLowerCase().min(2).max(80),
});

const updateTenantSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    contactName: z.preprocess(
      emptyStringToNull,
      z.string().trim().min(2).max(120).nullable().optional(),
    ),
    contactEmail: z.preprocess(
      emptyStringToNull,
      normalizedEmailSchema.nullable().optional(),
    ),
    contactPhone: z.preprocess(
      emptyStringToNull,
      contactPhoneSchema.nullable().optional(),
    ),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    {
      message: "Provide at least one field to update.",
    },
  );

const permanentDeleteCountSelection = {
  payments: true,
  plants: true,
  products: true,
  customers: true,
  drivers: true,
  routes: true,
  contracts: true,
  orders: true,
  shippingAddresses: true,
  shippingContacts: true,
  shippingContactMultiples: true,
  machineDispensaries: true,
  maintenances: true,
  vendors: true,
  reasons: true,
  rawMaterials: true,
  rawMaterialVariants: true,
  rawStockTransactions: true,
  rawDistributions: true,
  rawStockLogs: true,
  rawStockForPlants: true,
  plantProductions: true,
  plantProductionDetails: true,
  jarTransportations: true,
  jarMaintenances: true,
  jarTransportLogs: true,
  jarTransportDriverLogs: true,
  digitalCards: true,
  labReports: true,
  distributors: true,
  distributorPlantOrders: true,
  distributorPlantProductions: true,
  distributorPlantDispatches: true,
  distributorPlantOrderAcceptances: true,
  distributorPlantInventories: true,
  distributorPlantAllocations: true,
  orderGenerationFailures: true,
  scrabJars: true,
} as const;

const tenantDetailsInclude = {
  subscription: true,
  moduleAccess: { orderBy: { module: "asc" as const } },
  rolePermissions: {
    orderBy: [{ role: "asc" as const }, { module: "asc" as const }],
  },
  memberships: {
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  _count: {
    select: {
      memberships: true,
      plants: true,
      products: true,
      customers: true,
      orders: true,
      drivers: true,
      vendors: true,
      distributors: true,
      payments: true,
    },
  },
} as const;

/** GET /api/web/v1/platform/tenants/trash
 * IMPORTANT: register this static route before GET /:tenantId.
 */
tenantsRouter.get("/trash", async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: includeTenant,
    });

    res.json({
      data: tenants.map(serializeTenant),
      meta: { total: tenants.length },
    });
  } catch (error) {
    next(error);
  }
});

tenantsRouter.get("/:tenantId", async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.tenantId },
      include: tenantDetailsInclude,
    });

    if (!tenant) {
      return res.status(404).json({
        error: { code: "TENANT_NOT_FOUND", message: "Tenant not found." },
      });
    }

    const owner = tenant.memberships.find(
      (membership) =>
        membership.role === MembershipRole.TENANT_OWNER && membership.isActive,
    );
    const base = serializeTenant({
      ...tenant,
      memberships: owner ? [owner] : [],
    });

    return res.json({
      data: {
        ...base,
        contactName: tenant.contactName,
        contactEmail: tenant.contactEmail,
        contactPhone: tenant.contactPhone,
        deletedAt: tenant.deletedAt,
        moduleAccess: tenant.moduleAccess.map((access) => ({
          module: access.module,
          isEnabled: access.isEnabled,
        })),
        rolePermissions: tenant.rolePermissions.map((permission) => ({
          role: permission.role,
          module: permission.module,
          canView: permission.canView,
          canCreate: permission.canCreate,
          canEdit: permission.canEdit,
          canDelete: permission.canDelete,
        })),
        memberships: tenant.memberships.map((membership) => ({
          id: membership.id,
          userId: membership.userId,
          role: membership.role,
          isActive: membership.isActive,
          createdAt: membership.createdAt,
          user: membership.user,
        })),
        subscription: tenant.subscription
          ? {
              id: tenant.subscription.id,
              planCode: tenant.subscription.planCode,
              status: tenant.subscription.status,
              billingCycle: tenant.subscription.billingCycle,
              priceAmount: tenant.subscription.priceAmount?.toString() ?? null,
              currency: tenant.subscription.currency,
              startsAt: tenant.subscription.startsAt,
              trialEndsAt: tenant.subscription.trialEndsAt,
              currentPeriodStartsAt: tenant.subscription.currentPeriodStartsAt,
              currentPeriodEndsAt: tenant.subscription.currentPeriodEndsAt,
              canceledAt: tenant.subscription.canceledAt,
            }
          : null,
        counts: tenant._count,
      },
    });
  } catch (error) {
    next(error);
  }
});

tenantsRouter.patch("/:tenantId", async (req, res, next) => {
  const parsed = updateTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid tenant details.",
      },
    });
  }

  try {
    const current = await prisma.tenant.findUnique({
      where: { id: req.params.tenantId },
      select: { id: true, deletedAt: true },
    });

    if (!current) {
      return res.status(404).json({
        error: { code: "TENANT_NOT_FOUND", message: "Tenant not found." },
      });
    }
    if (current.deletedAt) {
      return res.status(409).json({
        error: {
          code: "TENANT_IN_TRASH",
          message: "Restore the tenant before editing it.",
        },
      });
    }

    const phoneWasProvided = Object.prototype.hasOwnProperty.call(
      req.body,
      "contactPhone",
    );
    const normalizedPhone = phoneWasProvided
      ? normalizePhoneToE164(parsed.data.contactPhone)
      : undefined;

    if (phoneWasProvided && normalizedPhone) {
      const duplicatePhone = await prisma.tenant.findFirst({
        where: {
          contactPhoneNormalized: normalizedPhone,
          id: { not: req.params.tenantId },
        },
        select: { id: true },
      });
      if (duplicatePhone) {
        return res.status(409).json({
          error: {
            code: "CONTACT_PHONE_IN_USE",
            message:
              "That contact phone number is already assigned to another workspace.",
          },
        });
      }
    }

    const updateData = {
      ...parsed.data,
      ...(phoneWasProvided ? { contactPhoneNormalized: normalizedPhone } : {}),
    };

    const updated = await withPlatformTransaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: req.params.tenantId },
        data: updateData,
        include: includeTenant,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId: tenant.id,
          action: "TENANT_UPDATED",
          entityType: "Tenant",
          entityId: tenant.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: { updatedFields: Object.keys(parsed.data) },
        },
      });
      return tenant;
    });

    return res.json({ data: serializeTenant(updated) });
  } catch (error: unknown) {
    if (getPrismaErrorCode(error) === "P2002") {
      if (
        prismaTargetHas(error, "contact_phone_normalized") ||
        prismaTargetHas(error, "contactphonenormalized")
      ) {
        return res.status(409).json({
          error: {
            code: "CONTACT_PHONE_IN_USE",
            message:
              "That contact phone number is already assigned to another workspace.",
          },
        });
      }
      if (prismaTargetHas(error, "slug")) {
        return res.status(409).json({
          error: {
            code: "TENANT_SLUG_IN_USE",
            message: "That workspace slug is already in use.",
          },
        });
      }
      return res.status(409).json({
        error: {
          code: "DUPLICATE_RECORD",
          message: "A unique field already exists.",
        },
      });
    }
    if (getPrismaErrorCode(error) === "P2025") {
      return res.status(404).json({
        error: { code: "TENANT_NOT_FOUND", message: "Tenant not found." },
      });
    }
    next(error);
  }
});

/** DELETE /api/web/v1/platform/tenants/:tenantId
 * Soft-delete only: tenant must first be suspended.
 */
tenantsRouter.delete("/:tenantId", async (req, res, next) => {
  try {
    const result = await withPlatformTransaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: req.params.tenantId },
      });
      if (!tenant)
        throw Object.assign(new Error("TENANT_NOT_FOUND"), {
          code: "TENANT_NOT_FOUND",
        });
      if (tenant.deletedAt)
        throw Object.assign(new Error("TENANT_ALREADY_IN_TRASH"), {
          code: "TENANT_ALREADY_IN_TRASH",
        });
      if (tenant.status !== TenantStatus.SUSPENDED) {
        throw Object.assign(new Error("TENANT_MUST_BE_SUSPENDED"), {
          code: "TENANT_MUST_BE_SUSPENDED",
        });
      }

      const now = new Date();
      const updated = await tx.tenant.update({
        where: { id: tenant.id },
        data: { deletedAt: now },
        include: { subscription: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId: tenant.id,
          action: "TENANT_SOFT_DELETED",
          entityType: "Tenant",
          entityId: tenant.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: { slug: tenant.slug, previousStatus: tenant.status },
        },
      });
      return updated;
    });

    return res.json({
      data: {
        id: result.id,
        deletedAt: result.deletedAt,
        status: result.status,
      },
    });
  } catch (error: unknown) {
    const code = getPrismaErrorCode(error);
    if (code === "TENANT_NOT_FOUND")
      return res
        .status(404)
        .json({ error: { code, message: "Tenant not found." } });
    if (code === "TENANT_ALREADY_IN_TRASH")
      return res
        .status(409)
        .json({ error: { code, message: "Tenant is already in Trash." } });
    if (code === "TENANT_MUST_BE_SUSPENDED")
      return res
        .status(409)
        .json({
          error: {
            code,
            message: "Suspend the tenant before moving it to Trash.",
          },
        });
    next(error);
  }
});

/** PATCH /api/web/v1/platform/tenants/:tenantId/restore
 * Restore as SUSPENDED. Restoring never grants access automatically.
 */
tenantsRouter.patch("/:tenantId/restore", async (req, res, next) => {
  try {
    const result = await withPlatformTransaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: req.params.tenantId },
      });
      if (!tenant)
        throw Object.assign(new Error("TENANT_NOT_FOUND"), {
          code: "TENANT_NOT_FOUND",
        });
      if (!tenant.deletedAt)
        throw Object.assign(new Error("TENANT_NOT_IN_TRASH"), {
          code: "TENANT_NOT_IN_TRASH",
        });

      const updated = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          deletedAt: null,
          status: TenantStatus.SUSPENDED,
          deactivatedAt: tenant.deactivatedAt ?? new Date(),
        },
        include: { subscription: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId: tenant.id,
          action: "TENANT_RESTORED_SUSPENDED",
          entityType: "Tenant",
          entityId: tenant.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: { slug: tenant.slug },
        },
      });
      return updated;
    });

    return res.json({
      data: {
        id: result.id,
        deletedAt: result.deletedAt,
        status: result.status,
      },
    });
  } catch (error: unknown) {
    const code = getPrismaErrorCode(error);
    if (code === "TENANT_NOT_FOUND")
      return res
        .status(404)
        .json({ error: { code, message: "Tenant not found." } });
    if (code === "TENANT_NOT_IN_TRASH")
      return res
        .status(409)
        .json({ error: { code, message: "Tenant is not in Trash." } });
    next(error);
  }
});

/** DELETE /api/web/v1/platform/tenants/:tenantId/permanent
 * Permanent deletion is blocked while operational/financial records exist.
 * Memberships cascade; old audit rows are retained with tenantId=NULL.
 */
tenantsRouter.delete("/:tenantId/permanent", async (req, res, next) => {
  const confirmation = permanentDeleteSchema.safeParse(req.body);
  if (!confirmation.success) {
    return res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Send confirmSlug with the exact workspace slug.",
      },
    });
  }

  try {
    const result = await withPlatformTransaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: req.params.tenantId },
        include: { _count: { select: permanentDeleteCountSelection } },
      });
      if (!tenant)
        throw Object.assign(new Error("TENANT_NOT_FOUND"), {
          code: "TENANT_NOT_FOUND",
        });
      if (!tenant.deletedAt)
        throw Object.assign(new Error("TENANT_MUST_BE_IN_TRASH"), {
          code: "TENANT_MUST_BE_IN_TRASH",
        });
      if (tenant.status !== TenantStatus.SUSPENDED)
        throw Object.assign(new Error("TENANT_MUST_BE_SUSPENDED"), {
          code: "TENANT_MUST_BE_SUSPENDED",
        });
      if (confirmation.data.confirmSlug !== tenant.slug.toLowerCase()) {
        throw Object.assign(new Error("TENANT_CONFIRMATION_MISMATCH"), {
          code: "TENANT_CONFIRMATION_MISMATCH",
        });
      }

      const blockers = Object.entries(tenant._count)
        .filter(([, count]) => Number(count) > 0)
        .map(([relation, count]) => ({ relation, count: Number(count) }));
      if (blockers.length) {
        throw Object.assign(new Error("TENANT_HAS_DEPENDENCIES"), {
          code: "TENANT_HAS_DEPENDENCIES",
          blockers,
        });
      }

      // This audit record intentionally has tenantId=NULL so it survives tenant deletion.
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId: null,
          action: "TENANT_PERMANENTLY_DELETED",
          entityType: "Tenant",
          entityId: tenant.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: {
            tenantId: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          },
        },
      });
      await tx.tenant.delete({ where: { id: tenant.id } });
      return { id: tenant.id, name: tenant.name, slug: tenant.slug };
    });

    return res.json({ data: { deleted: true, tenant: result } });
  } catch (error: unknown) {
    const code = getPrismaErrorCode(error);
    if (code === "TENANT_NOT_FOUND")
      return res
        .status(404)
        .json({ error: { code, message: "Tenant not found." } });
    if (code === "TENANT_MUST_BE_IN_TRASH")
      return res
        .status(409)
        .json({
          error: {
            code,
            message:
              "Move the suspended tenant to Trash before permanent deletion.",
          },
        });
    if (code === "TENANT_MUST_BE_SUSPENDED")
      return res
        .status(409)
        .json({
          error: {
            code,
            message: "Tenant must be suspended before permanent deletion.",
          },
        });
    if (code === "TENANT_CONFIRMATION_MISMATCH")
      return res
        .status(400)
        .json({
          error: {
            code,
            message: "confirmSlug does not match this workspace slug.",
          },
        });
    if (code === "TENANT_HAS_DEPENDENCIES") {
      return res.status(409).json({
        error: {
          code,
          message:
            "Permanent deletion is blocked while related business or payment records exist. Retain or explicitly archive those records first.",
          dependencies: getErrorBlockers(error) ?? [],
        },
      });
    }
    if (code === "P2003" || code === "P2014") {
      return res.status(409).json({
        error: {
          code: "TENANT_HAS_DEPENDENCIES",
          message: "Permanent deletion is blocked by related records.",
        },
      });
    }
    next(error);
  }
});
