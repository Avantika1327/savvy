import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  BillingCycle,
  MembershipRole,
  PaymentMethod,
  PaymentStatus,
  PlatformRole,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
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
const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  contactName: z.string().trim().min(2).max(120).optional(),
  contactEmail: z.string().trim().email().max(254).optional(),
  contactPhone: z.string().trim().min(7).max(30).optional(),
  planCode: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]).default("STARTER"),
  priceAmount: z.number().min(0).max(100000000).optional(),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  ownerPassword: z.string().min(12).max(128),
  trialDays: z.number().int().min(0).max(90).default(14),
});

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

function serializeTenant(t: any) {
  const effectiveStatus = effectiveTenantStatus({
    status: t.status,
    subscription: t.subscription,
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
    where: { role: MembershipRole.TENANT_OWNER },
    take: 1,
    include: { user: { select: { name: true, email: true } } },
  },
} as const;

tenantsRouter.get("/", async (_req, res, next) => {
  try {
    const [tenants, total, active, suspended, paymentPending, expired] =
      await Promise.all([
        prisma.tenant.findMany({
          orderBy: { createdAt: "desc" },
          include: includeTenant,
        }),
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
        prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
        prisma.tenant.count({
          where: {
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
    const duplicate = await prisma.user.findUnique({
      where: { email: input.ownerEmail },
      select: { id: true },
    });
    if (duplicate)
      return res.status(409).json({
        error: {
          code: "EMAIL_IN_USE",
          message: "This email already belongs to an account.",
        },
      });
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
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002")
      return res.status(409).json({
        error: {
          code: "TENANT_CONFLICT",
          message: "Tenant slug or owner email already exists.",
        },
      });
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
  } catch (error: any) {
    next(error);
  }
});

const subscriptionSchema = z.object({
  planCode: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]),
  billingCycle: z.nativeEnum(BillingCycle),
  priceAmount: z.number().min(0).max(100000000),
  currency: z.string().trim().length(3).default("INR"),
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
  amount: z.number().positive().max(100000000),
  currency: z.string().trim().length(3).default("INR"),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.MANUAL),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
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
    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub)
      return res.status(404).json({
        error: {
          code: "SUBSCRIPTION_NOT_FOUND",
          message: "Tenant subscription not found.",
        },
      });
    const p = parsed.data;
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
  } catch (error) {
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
    } catch (error: any) {
      if (
        [
          "PAYMENT_NOT_FOUND",
          "PAYMENT_NOT_PENDING",
          "PAYMENT_AMOUNT_INSUFFICIENT",
        ].includes(error?.code)
      ) {
        const messages: Record<string, string> = {
          PAYMENT_NOT_FOUND: "Payment not found for this tenant.",
          PAYMENT_NOT_PENDING: "Only pending payments can be confirmed.",
          PAYMENT_AMOUNT_INSUFFICIENT:
            "Payment amount is less than the assigned subscription price.",
        };
        return res
          .status(error.code === "PAYMENT_NOT_FOUND" ? 404 : 409)
          .json({ error: { code: error.code, message: messages[error.code] } });
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
