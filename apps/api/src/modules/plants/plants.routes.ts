import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  requireActiveTenant,
} from "../../middleware/auth.middleware.js";
import { withTenantTransaction } from "../../lib/tenant-transaction.js";

export const plantsRouter = Router();
plantsRouter.use(authenticate("web"), requireActiveTenant);
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(250).optional(),
  manager: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(20).optional(),
  details: z.string().trim().max(2000).optional(),
});
plantsRouter.get("/", async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId!;
    const plants = await withTenantTransaction(tenantId, (tx) =>
      tx.plant.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
    );
    res.json({ data: plants });
  } catch (error) {
    next(error);
  }
});
plantsRouter.post("/", async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid plant details.",
      },
    });
  try {
    const tenantId = req.auth!.tenantId!;
    const plant = await withTenantTransaction(tenantId, (tx) =>
      tx.plant.create({ data: { ...parsed.data, tenantId } }),
    );
    res.status(201).json({ data: plant });
  } catch (error: any) {
    if (error?.code === "P2002")
      return res.status(409).json({
        error: {
          code: "PLANT_EXISTS",
          message: "A plant with this name already exists in your tenant.",
        },
      });
    next(error);
  }
});
