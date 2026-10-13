import { Router } from "express";
import {
  webAuthRouter,
  platformAuthRouter,
} from "../../modules/auth/auth.routes.js";
import { tenantsRouter } from "../../modules/tenants/tenants.routes.js";
import { plantsRouter } from "../../modules/plants/plants.routes.js";
export const webRouter = Router();
webRouter.use("/platform-auth", platformAuthRouter); // Dedicated login for the SaaS platform owner.
webRouter.use("/auth", webAuthRouter); // Tenant/customer web login only.
webRouter.use("/platform/tenants", tenantsRouter); // Platform-super-admin-only tenant control plane.
webRouter.use("/plants", plantsRouter); // Tenant-scoped example module with database isolation.
webRouter.get("/status", (_req, res) =>
  res.json({
    surface: "web",
    modules: [
      "plants",
      "routes",
      "drivers",
      "customers",
      "orders",
      "raw-stock",
      "products",
      "lab-reports",
      "maintenance",
      "vendors",
      "distributors",
      "reports",
    ],
    tenancy: "enabled",
  }),
);
