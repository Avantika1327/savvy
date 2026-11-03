import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { MembershipRole, Prisma } from "@prisma/client";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import {
  authenticate,
  requireActiveTenant,
} from "../../middleware/auth.middleware.js";
import { withTenantTransaction } from "../../lib/tenant-transaction.js";
import {
  revokePendingPlantManagerInvitations,
  sendPlantManagerInvitation,
} from "./plant-manager-invitations.service.js";

export const plantsRouter = Router();
plantsRouter.use(authenticate("web"), requireActiveTenant);

/**
 * Required for create. PATCH uses optional versions of the same validators so
 * clients can update one field without allowing supplied values to be blank.
 */
const requiredText = (label: string, max: number, min = 1) =>
  z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} must be text.` })
    .trim()
    .min(min, min > 1 ? `${label} must be at least ${min} characters.` : `${label} is required.`)
    .max(max, `${label} must not exceed ${max} characters.`);

const optionalText = (max: number) =>
  z.string().trim().max(max, `Must not exceed ${max} characters.`).nullable().optional();

const managerEmailSchema = z
  .string({ required_error: "Manager email is required.", invalid_type_error: "Manager email must be text." })
  .trim()
  .min(1, "Manager email is required.")
  .max(254, "Manager email must not exceed 254 characters.")
  .email("Enter a valid manager email address.")
  .transform((value) => value.toLowerCase());

const coverageTypeSchema = z.enum(["LOCAL", "PAN_INDIA"], {
  required_error: "Coverage type is required.",
  invalid_type_error: "Coverage type must be LOCAL or PAN_INDIA.",
});

const pincodeSchema = z
  .string({ required_error: "PIN code is required.", invalid_type_error: "PIN code must be text." })
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code.");

const sanitizePlantDetails = (
  value: string | null | undefined,
): string | null | undefined => {
  if (value === undefined || value === null || value.trim() === "") {
    return value ?? null;
  }

  return sanitizeHtml(value, {
    allowedTags: [
      "p", "div", "br", "strong", "b", "em", "i", "u", "s",
      "ul", "ol", "li", "blockquote", "h2", "h3", "pre", "code", "a",
    ],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform(
        "a",
        { rel: "noopener noreferrer", target: "_blank" },
        true,
      ),
    },
  });
};

// Create: every field is required except details.
const createSchema = z
  .object({
    name: requiredText("Plant name", 120, 2),
    address: requiredText("Address", 250),
    manager: requiredText("Manager name", 120, 2),
    managerEmail: managerEmailSchema,
    coverageType: coverageTypeSchema,
    location: requiredText("Location", 120),
    pincode: pincodeSchema,
    details: optionalText(15000),
  })
  .strict();

// Update: supplied fields must be valid, but omitted fields remain unchanged.
// Required business fields cannot be cleared with null/empty values.
const updateSchema = z
  .object({
    name: requiredText("Plant name", 120, 2).optional(),
    address: requiredText("Address", 250).optional(),
    manager: requiredText("Manager name", 120, 2).optional(),
    managerEmail: managerEmailSchema.optional(),
    coverageType: coverageTypeSchema.optional(),
    location: requiredText("Location", 120).optional(),
    pincode: pincodeSchema.optional(),
    details: optionalText(15000),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    { message: "Provide at least one field to update." },
  );

const statusSchema = z.object({
  isActive: z.boolean({
    required_error: "isActive is required.",
    invalid_type_error: "isActive must be true or false.",
  }),
}).strict();

const plantSelect = {
  id: true,
  tenantId: true,
  name: true,
  address: true,
  manager: true,
  managerEmail: true,
  coverageType: true,
  location: true,
  pincode: true,
  details: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

class PlantRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PlantRouteError";
  }
}

type AsyncRoute = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/** One async wrapper avoids repeating try/catch in every route. */
function asyncHandler(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizePlantName(name: string): string {
  return name.trim().toLowerCase();
}

function parsePlantId(rawId: string | undefined): number | null {
  if (!rawId || !/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function tenantIdFromRequest(req: Request): string {
  const tenantId = req.auth?.tenantId;
  if (!tenantId) {
    throw new PlantRouteError(
      403,
      "TENANT_CONTEXT_REQUIRED",
      "An active tenant workspace is required for this operation.",
    );
  }
  return tenantId;
}

function requirePlantManager(req: Request, res: Response, next: NextFunction) {
  const role = req.auth?.tenantRole;
  const allowedRoles: MembershipRole[] = [
    MembershipRole.TENANT_OWNER,
    MembershipRole.TENANT_ADMIN,
    MembershipRole.MANAGER,
  ];

  if (!role || !allowedRoles.includes(role)) {
    return res.status(403).json({
      error: {
        code: "PLANT_WRITE_FORBIDDEN",
        message: "Your workspace role does not allow plant changes.",
      },
    });
  }
  return next();
}

function requireTenantAdministrator(req: Request, res: Response, next: NextFunction) {
  const role = req.auth?.tenantRole;
  if (role !== MembershipRole.TENANT_OWNER && role !== MembershipRole.TENANT_ADMIN) {
    return res.status(403).json({
      error: {
        code: "PLANT_MANAGER_INVITE_FORBIDDEN",
        message: "Only a tenant owner or tenant admin can create plants or send/reassign Plant Manager invitations.",
      },
    });
  }
  return next();
}

function validationResponse(res: Response, error: z.ZodError) {
  const details = error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join(".") : "body",
    message: issue.message,
  }));
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: details[0]?.message ?? "Please check the submitted plant details.",
      details,
    },
  });
}

function sendPlantNotFound(res: Response) {
  return res.status(404).json({
    error: {
      code: "PLANT_NOT_FOUND",
      message: "Plant not found in this workspace.",
    },
  });
}

function sendDuplicateName(res: Response) {
  return res.status(409).json({
    error: {
      code: "PLANT_NAME_IN_USE",
      message: "A plant with this name already exists in this workspace.",
    },
  });
}

async function trySendManagerInvitation(input: {
  tenantId: string;
  plantId: number;
  plantName: string;
  managerName: string | null;
  managerEmail: string;
  createdByUserId: number;
}) {
  try {
    return await sendPlantManagerInvitation(input);
  } catch (error) {
    // The plant is already committed; turn email failures into an actionable result.
    console.error("Plant Manager invitation email failed", error);
    return {
      sent: false,
      code: "EMAIL_SEND_FAILED",
      message:
        "The plant was saved, but the invitation email could not be sent. Check SMTP settings and retry the invitation.",
    };
  }
}

// GET /api/web/v1/plants — tenant-scoped, non-deleted plant list.
plantsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = tenantIdFromRequest(req);
    const where: Prisma.PlantWhereInput = { tenantId, deletedAt: null };

    // A manager only sees their assigned plant(s), not every plant in the tenant.
    if (req.auth?.tenantRole === MembershipRole.MANAGER) {
      where.managerId = req.auth.userId;
    }

    const plants = await withTenantTransaction(tenantId, (tx) =>
      tx.plant.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        select: plantSelect,
      }),
    );

    return res.json({
      data: plants,
      meta: {
        total: plants.length,
        active: plants.filter((plant) => plant.isActive).length,
        inactive: plants.filter((plant) => !plant.isActive).length,
      },
    });
  }),
);

// POST /api/web/v1/plants — tenant owners/admins create plants and invite the manager.
plantsRouter.post(
  "/",
  requireTenantAdministrator,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return validationResponse(res, parsed.error);

    const tenantId = tenantIdFromRequest(req);
    const actorUserId = req.auth!.userId as number;
    const input = parsed.data;
    const normalizedName = normalizePlantName(input.name);

    const plant = await withTenantTransaction(tenantId, async (tx) => {
      const duplicate = await tx.plant.findFirst({
        where: { tenantId, normalizedName },
        select: { id: true },
      });
      if (duplicate) {
        throw new PlantRouteError(
          409,
          "PLANT_NAME_IN_USE",
          "A plant with this name already exists in this workspace.",
        );
      }

      const created = await tx.plant.create({
        data: {
          name: input.name,
          normalizedName,
          address: input.address,
          manager: input.manager,
          managerEmail: input.managerEmail,
          coverageType: input.coverageType,
          location: input.location,
          pincode: input.pincode,
          details: sanitizePlantDetails(input.details),
          tenantId,
          isActive: true,
        },
        select: plantSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: "PLANT_CREATED",
          entityType: "Plant",
          entityId: String(created.id),
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: { name: created.name },
        },
      });
      return created;
    });

    const managerInvitation = await trySendManagerInvitation({
      tenantId,
      plantId: plant.id,
      plantName: plant.name,
      managerName: plant.manager,
      managerEmail: plant.managerEmail!,
      createdByUserId: actorUserId,
    });

    return res.status(201).json({ data: plant, managerInvitation });
  }),
);

// POST /api/web/v1/plants/:plantId/manager-invitation — send or resend the invite.
plantsRouter.post(
  "/:plantId/manager-invitation",
  requireTenantAdministrator,
  asyncHandler(async (req, res) => {
    const id = parsePlantId(req.params.plantId);
    if (!id) {
      throw new PlantRouteError(400, "INVALID_PLANT_ID", "Plant ID must be a positive integer.");
    }

    const tenantId = tenantIdFromRequest(req);
    const plant = await withTenantTransaction(tenantId, (tx) =>
      tx.plant.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: { id: true, name: true, manager: true, managerEmail: true },
      }),
    );

    if (!plant) return sendPlantNotFound(res);
    if (!plant.managerEmail) {
      throw new PlantRouteError(
        400,
        "MANAGER_EMAIL_REQUIRED",
        "Add a valid manager email to this plant before sending an invitation.",
      );
    }

    const result = await trySendManagerInvitation({
      tenantId,
      plantId: plant.id,
      plantName: plant.name,
      managerName: plant.manager,
      managerEmail: plant.managerEmail,
      createdByUserId: req.auth!.userId as number,
    });

    return res.status(result.sent ? 202 : 503).json({ data: result });
  }),
);

// PATCH /api/web/v1/plants/:plantId — partial update.
plantsRouter.patch(
  "/:plantId",
  requirePlantManager,
  asyncHandler(async (req, res) => {
    const id = parsePlantId(req.params.plantId);
    if (!id) {
      throw new PlantRouteError(400, "INVALID_PLANT_ID", "Plant ID must be a positive integer.");
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return validationResponse(res, parsed.error);

    const tenantId = tenantIdFromRequest(req);
    const input = parsed.data;

    // A Plant Manager may edit operational plant details, but cannot reassign themselves.
    if (
      req.auth?.tenantRole === MembershipRole.MANAGER &&
      (input.manager !== undefined || input.managerEmail !== undefined)
    ) {
      throw new PlantRouteError(
        403,
        "PLANT_MANAGER_REASSIGN_FORBIDDEN",
        "Only a tenant owner or tenant admin can change the assigned Plant Manager.",
      );
    }

    const result = await withTenantTransaction(tenantId, async (tx) => {
      const current = await tx.plant.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          deletedAt: true,
          managerId: true,
          manager: true,
          managerEmail: true,
        },
      });

      if (!current) {
        throw new PlantRouteError(404, "PLANT_NOT_FOUND", "Plant not found in this workspace.");
      }
      if (current.deletedAt) {
        throw new PlantRouteError(409, "PLANT_DELETED", "A deleted plant cannot be edited.");
      }
      if (
        req.auth?.tenantRole === MembershipRole.MANAGER &&
        current.managerId !== req.auth.userId
      ) {
        // Use 404 to avoid revealing plants assigned to other people.
        throw new PlantRouteError(404, "PLANT_NOT_FOUND", "Plant not found in this workspace.");
      }

      const data: Prisma.PlantUpdateInput = {};
      const managerEmailChanged =
        input.managerEmail !== undefined && input.managerEmail !== current.managerEmail;
      const managerInvitationIdentityChanged =
        managerEmailChanged ||
        (input.manager !== undefined && input.manager !== current.manager);

      if (managerEmailChanged) data.managerRecord = { disconnect: true };
      if (input.name !== undefined) {
        data.name = input.name;
        data.normalizedName = normalizePlantName(input.name);
      }
      if (input.address !== undefined) data.address = input.address;
      if (input.manager !== undefined) data.manager = input.manager;
      if (input.managerEmail !== undefined) data.managerEmail = input.managerEmail;
      if (input.coverageType !== undefined) data.coverageType = input.coverageType;
      if (input.location !== undefined) data.location = input.location;
      if (input.pincode !== undefined) data.pincode = input.pincode;
      if (input.details !== undefined) data.details = sanitizePlantDetails(input.details);

      if (input.name !== undefined) {
        const duplicate = await tx.plant.findFirst({
          where: {
            tenantId,
            normalizedName: normalizePlantName(input.name),
            id: { not: id },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new PlantRouteError(
            409,
            "PLANT_NAME_IN_USE",
            "A plant with this name already exists in this workspace.",
          );
        }
      }

      const updated = await tx.plant.update({
        where: { id_tenantId: { id, tenantId } },
        data,
        select: plantSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: "PLANT_UPDATED",
          entityType: "Plant",
          entityId: String(updated.id),
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: { updatedFields: Object.keys(input) },
        },
      });

      return { updated, managerInvitationIdentityChanged };
    });

    if (result.managerInvitationIdentityChanged) {
      await revokePendingPlantManagerInvitations(tenantId, id);
    }

    return res.json({ data: result.updated });
  }),
);

// PATCH /api/web/v1/plants/:plantId/status — activate/deactivate without deleting data.
plantsRouter.patch(
  "/:plantId/status",
  requirePlantManager,
  asyncHandler(async (req, res) => {
    const id = parsePlantId(req.params.plantId);
    if (!id) {
      throw new PlantRouteError(400, "INVALID_PLANT_ID", "Plant ID must be a positive integer.");
    }

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return validationResponse(res, parsed.error);

    const tenantId = tenantIdFromRequest(req);
    const plant = await withTenantTransaction(tenantId, async (tx) => {
      const current = await tx.plant.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: { id: true, isActive: true, managerId: true },
      });

      if (!current) {
        throw new PlantRouteError(404, "PLANT_NOT_FOUND", "Plant not found in this workspace.");
      }
      if (
        req.auth?.tenantRole === MembershipRole.MANAGER &&
        current.managerId !== req.auth.userId
      ) {
        throw new PlantRouteError(404, "PLANT_NOT_FOUND", "Plant not found in this workspace.");
      }

      const updated = await tx.plant.update({
        where: { id_tenantId: { id, tenantId } },
        data: { isActive: parsed.data.isActive },
        select: plantSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: parsed.data.isActive ? "PLANT_ACTIVATED" : "PLANT_DEACTIVATED",
          entityType: "Plant",
          entityId: String(updated.id),
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500),
          metadata: {
            previousIsActive: current.isActive,
            isActive: updated.isActive,
          },
        },
      });
      return updated;
    });

    return res.json({ data: plant });
  }),
);

/** One final error handler gives every route a consistent response shape. */
plantsRouter.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof PlantRouteError) {
      return res.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = error.meta?.target;
        const targetText = Array.isArray(target) ? target.join(" ") : String(target ?? "");
        if (/normalizedName|normalized_name|tenantId.*name|name.*tenantId/i.test(targetText)) {
          return sendDuplicateName(res);
        }
        return res.status(409).json({
          error: {
            code: "PLANT_CONFLICT",
            message: "The plant conflicts with an existing record. Check the submitted values and try again.",
          },
        });
      }

      if (error.code === "P2025") {
        return sendPlantNotFound(res);
      }

      if (error.code === "P2003") {
        return res.status(409).json({
          error: {
            code: "PLANT_RELATION_CONFLICT",
            message: "This change conflicts with a related record. Refresh the plant and try again.",
          },
        });
      }
    }

    // Keep implementation details out of the HTTP response; log the full error server-side.
    console.error("Unhandled error in plants routes", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong while processing the plant request. Please try again.",
      },
    });
  },
);
