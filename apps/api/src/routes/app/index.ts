import { Router } from "express";
import { appAuthRouter } from "../../modules/auth/auth.routes.js";
export const appRouter = Router();
appRouter.use("/auth", appAuthRouter); // Kept under the mobile API namespace; port OTP verification before production use.
appRouter.get("/status", (_req, res) =>
  res.json({
    surface: "app",
    clients: ["driver", "customer", "vendor", "distributor"],
    note: "App/mobile routes are isolated from web routes and must use tenant-scoped auth.",
  }),
);
// TODO: port source app OTP, phone verification, app versions, driver/customer/distributor routes and actions.
