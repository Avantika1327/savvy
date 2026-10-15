import { Router, type NextFunction, type Request, type Response } from 'express';
import { MembershipRole, Prisma } from '@prisma/client';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { authenticate, requireActiveTenant } from '../../middleware/auth.middleware.js';
import { withTenantTransaction } from '../../lib/tenant-transaction.js';

export const plantsRouter = Router();
plantsRouter.use(authenticate('web'), requireActiveTenant);

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalEmail = z.string().trim().email().max(254).transform((value) => value.toLowerCase()).nullable().optional();
const coverageTypeSchema = z.enum(['LOCAL', 'PAN_INDIA']);

const sanitizePlantDetails = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined || value === null || value.trim() === '') return value ?? null;
  return sanitizeHtml(value, {
    allowedTags: ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'pre', 'code', 'a'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }, true),
    },
  });
};

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: optionalText(250),
  manager: optionalText(120),
  managerEmail: optionalEmail,
  coverageType: coverageTypeSchema.default('LOCAL'),
  location: optionalText(120),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/).nullable().optional(),
  details: optionalText(15000),
}).strict();

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  address: optionalText(250),
  manager: optionalText(120),
  managerEmail: optionalEmail,
  coverageType: coverageTypeSchema.optional(),
  location: optionalText(120),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/).nullable().optional(),
  details: optionalText(15000),
}).strict().refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  { message: 'Provide at least one field to update.' },
);

const statusSchema = z.object({ isActive: z.boolean() }).strict();

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

function normalizePlantName(name: string): string {
  return name.trim().toLowerCase();
}

function parsePlantId(rawId: string | undefined): number | null {
  if (!rawId || !/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
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
        code: 'PLANT_WRITE_FORBIDDEN',
        message: 'Only a tenant owner, tenant admin, or manager can change plant records.',
      },
    });
  }

  return next();
}

function sendValidationError(res: Response, message: string) {
  return res.status(400).json({
    error: { code: 'VALIDATION_ERROR', message },
  });
}

function sendPlantNotFound(res: Response) {
  return res.status(404).json({
    error: { code: 'PLANT_NOT_FOUND', message: 'Plant not found in this workspace.' },
  });
}

function sendDuplicateName(res: Response) {
  return res.status(409).json({
    error: { code: 'PLANT_NAME_IN_USE', message: 'A plant with this name already exists in this workspace.' },
  });
}

function handlePrismaError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return sendDuplicateName(res);
  }
  return next(error);
}

// GET /api/web/v1/plants — active and inactive (non-deleted) plants for this tenant only.
plantsRouter.get('/', async (req, res, next) => {
  const tenantId = req.auth!.tenantId!;
  try {
    const plants = await withTenantTransaction(tenantId, (tx) =>
      tx.plant.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
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
  } catch (error) {
    return next(error);
  }
});

// POST /api/web/v1/plants — create a plant within the authenticated tenant.
plantsRouter.post('/', requirePlantManager, async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error.issues[0]?.message ?? 'Invalid plant details.');
  }

  const tenantId = req.auth!.tenantId!;
  const input = parsed.data;

  try {
    const plant = await withTenantTransaction(tenantId, async (tx) => {
      const normalizedName = normalizePlantName(input.name);
      const duplicate = await tx.plant.findFirst({
        where: { tenantId, normalizedName },
        select: { id: true },
      });
      if (duplicate) throw Object.assign(new Error('PLANT_NAME_IN_USE'), { code: 'PLANT_NAME_IN_USE' });

      const created = await tx.plant.create({
        data: {
          ...input,
          name: input.name.trim(),
          managerEmail: input.managerEmail ?? null,
          details: sanitizePlantDetails(input.details),
          normalizedName,
          tenantId,
          isActive: true,
        },
        select: plantSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: 'PLANT_CREATED',
          entityType: 'Plant',
          entityId: String(created.id),
          ipAddress: req.ip,
          userAgent: req.get('user-agent')?.slice(0, 500),
          metadata: { name: created.name },
        },
      });
      return created;
    });

    return res.status(201).json({ data: plant });
  } catch (error: any) {
    if (error?.code === 'PLANT_NAME_IN_USE') return sendDuplicateName(res);
    return handlePrismaError(error, res, next);
  }
});

// PATCH /api/web/v1/plants/:plantId — edit plant fields; tenant ownership is enforced in the query/RLS context.
plantsRouter.patch('/:plantId', requirePlantManager, async (req, res, next) => {
  const id = parsePlantId(req.params.plantId);
  if (!id) return sendValidationError(res, 'Plant ID must be a positive integer.');

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, parsed.error.issues[0]?.message ?? 'Invalid plant details.');
  }

  const tenantId = req.auth!.tenantId!;
  const input = parsed.data;

  try {
    const plant = await withTenantTransaction(tenantId, async (tx) => {
      const current = await tx.plant.findFirst({
        where: { id, tenantId },
        select: { id: true, deletedAt: true },
      });
      if (!current) throw Object.assign(new Error('PLANT_NOT_FOUND'), { code: 'PLANT_NOT_FOUND' });
      if (current.deletedAt) throw Object.assign(new Error('PLANT_DELETED'), { code: 'PLANT_DELETED' });

      const data: Prisma.PlantUpdateInput = {};
      if (input.name !== undefined) {
        data.name = input.name.trim();
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
          where: { tenantId, normalizedName: normalizePlantName(input.name), id: { not: id } },
          select: { id: true },
        });
        if (duplicate) throw Object.assign(new Error('PLANT_NAME_IN_USE'), { code: 'PLANT_NAME_IN_USE' });
      }

      const updated = await tx.plant.update({ where: { id }, data, select: plantSelect });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: 'PLANT_UPDATED',
          entityType: 'Plant',
          entityId: String(updated.id),
          ipAddress: req.ip,
          userAgent: req.get('user-agent')?.slice(0, 500),
          metadata: { updatedFields: Object.keys(input) },
        },
      });
      return updated;
    });

    return res.json({ data: plant });
  } catch (error: any) {
    if (error?.code === 'PLANT_NAME_IN_USE') return sendDuplicateName(res);
    if (error?.code === 'PLANT_NOT_FOUND') return sendPlantNotFound(res);
    if (error?.code === 'PLANT_DELETED') {
      return res.status(409).json({ error: { code: error.code, message: 'A deleted plant cannot be edited.' } });
    }
    if (error?.code === 'P2025') return sendPlantNotFound(res);
    return handlePrismaError(error, res, next);
  }
});

// PATCH /api/web/v1/plants/:plantId/status — activate/deactivate without deleting data.
plantsRouter.patch('/:plantId/status', requirePlantManager, async (req, res, next) => {
  const id = parsePlantId(req.params.plantId);
  if (!id) return sendValidationError(res, 'Plant ID must be a positive integer.');

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, 'isActive must be a boolean.');

  const tenantId = req.auth!.tenantId!;
  try {
    const plant = await withTenantTransaction(tenantId, async (tx) => {
      const current = await tx.plant.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: { id: true, isActive: true },
      });
      if (!current) throw Object.assign(new Error('PLANT_NOT_FOUND'), { code: 'PLANT_NOT_FOUND' });

      const updated = await tx.plant.update({
        where: { id },
        data: { isActive: parsed.data.isActive },
        select: plantSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.userId,
          tenantId,
          action: parsed.data.isActive ? 'PLANT_ACTIVATED' : 'PLANT_DEACTIVATED',
          entityType: 'Plant',
          entityId: String(updated.id),
          ipAddress: req.ip,
          userAgent: req.get('user-agent')?.slice(0, 500),
          metadata: { previousIsActive: current.isActive, isActive: updated.isActive },
        },
      });
      return updated;
    });

    return res.json({ data: plant });
  } catch (error: any) {
    if (error?.code === 'PLANT_NOT_FOUND' || error?.code === 'P2025') return sendPlantNotFound(res);
    return next(error);
  }
});
