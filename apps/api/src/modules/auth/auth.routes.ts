import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  LoginError,
  loginPlatformAdmin,
  loginTenantUser,
} from "./auth.service.js";

export const platformAuthRouter = Router();
export const webAuthRouter = Router();
export const appAuthRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "LOGIN_RATE_LIMIT",
      message: "Too many sign-in attempts. Try again in 15 minutes.",
    },
  },
});
platformAuthRouter.use(loginLimiter);
webAuthRouter.use(loginLimiter);
appAuthRouter.use(loginLimiter);
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};
function issueWebCookie(res: any, token: string) {
  res.cookie("savvy_access", token, cookieOptions);
}
function clearWebCookie(res: any) {
  res.clearCookie("savvy_access", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  });
}
const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});
const tenantCredentials = credentials.extend({
  tenantSlug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
function loginError(res: any, error: unknown) {
  if (error instanceof LoginError) {
    const status =
      error.code === "INVALID_CREDENTIALS"
        ? 401
        : error.code === "PLATFORM_ADMIN_REQUIRED"
          ? 403
          : 403;
    const message =
      error.code === "INVALID_CREDENTIALS"
        ? "Email or password is incorrect."
        : error.code === "PLATFORM_ADMIN_REQUIRED"
          ? "This account is not authorized for platform administrator access."
          : error.code === "SUPER_ADMIN_CANNOT_USE_TENANT"
            ? "Platform super-admin accounts cannot sign in as tenant users."
            : error.code === "TENANT_UNAVAILABLE"
              ? "This tenant is currently inactive. Contact the platform administrator."
              : "This account is not a member of the selected tenant.";
    return res.status(status).json({ error: { code: error.code, message } });
  }
  throw error;
}
platformAuthRouter.post("/logout", (_req, res) => {
  clearWebCookie(res);
  res.status(204).end();
});
platformAuthRouter.post("/login", async (req, res, next) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Enter a valid email and password.",
      },
    });
  try {
    const result = await loginPlatformAdmin(
      parsed.data.email,
      parsed.data.password,
    );
    issueWebCookie(res, result.accessToken);
    const { accessToken: _token, ...body } = result;
    return res.json(body);
  } catch (e) {
    try {
      return loginError(res, e);
    } catch (unhandled) {
      next(unhandled);
    }
  }
});
webAuthRouter.post("/logout", (_req, res) => {
  clearWebCookie(res);
  res.status(204).end();
});
webAuthRouter.post("/login", async (req, res, next) => {
  const parsed = tenantCredentials.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Enter tenant slug, email and password.",
      },
    });
  try {
    const result = await loginTenantUser({ ...parsed.data, surface: "web" });
    issueWebCookie(res, result.accessToken);
    const { accessToken: _token, ...body } = result;
    return res.json(body);
  } catch (e) {
    try {
      return loginError(res, e);
    } catch (unhandled) {
      next(unhandled);
    }
  }
});
// Mobile auth has a separate route contract; this credential flow is only a starter adapter.
// Port the source app's OTP/verification requirements before enabling this in production.
appAuthRouter.post("/login", async (req, res, next) => {
  const parsed = tenantCredentials.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Enter tenant slug, email and password.",
      },
    });
  try {
    return res.json(await loginTenantUser({ ...parsed.data, surface: "app" }));
  } catch (e) {
    try {
      return loginError(res, e);
    } catch (unhandled) {
      next(unhandled);
    }
  }
});
