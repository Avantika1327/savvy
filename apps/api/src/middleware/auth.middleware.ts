import type { NextFunction, Request, Response } from "express";
import { PlatformRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../modules/auth/auth.service.js";
import { tenantAccessAllowed } from "../modules/tenants/tenant-access.js";
import type { AuthPrincipal, AuthSurface } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
    }
  }
}

export function authenticate(surface: AuthSurface) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ")
      ? header.slice(7)
      : (req.cookies?.savvy_access as string | undefined);
    if (!token)
      return res
        .status(401)
        .json({ error: { code: "AUTH_REQUIRED", message: "Please sign in." } });
    try {
      const principal = verifyAccessToken(token);
      if (principal.surface !== surface)
        return res.status(403).json({
          error: {
            code: "WRONG_AUTH_SURFACE",
            message: "Use the correct web, app, or platform login.",
          },
        });
      req.auth = principal;
      next();
    } catch {
      return res.status(401).json({
        error: {
          code: "INVALID_TOKEN",
          message: "Your session is invalid or expired.",
        },
      });
    }
  };
}

export function requirePlatformSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    !req.auth ||
    req.auth.surface !== "platform" ||
    req.auth.platformRole !== PlatformRole.SUPER_ADMIN
  ) {
    return res.status(403).json({
      error: {
        code: "PLATFORM_ADMIN_REQUIRED",
        message: "Platform super-admin access is required.",
      },
    });
  }
  next();
}

export async function requireActiveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const auth = req.auth;
    if (!auth?.tenantId || !auth.tenantRole)
      return res.status(403).json({
        error: {
          code: "TENANT_CONTEXT_REQUIRED",
          message: "A tenant account is required.",
        },
      });
    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: auth.userId, tenantId: auth.tenantId, isActive: true },
      include: { tenant: { include: { subscription: true } } },
    });
    if (!membership || !tenantAccessAllowed(membership.tenant)) {
      return res.status(403).json({
        error: {
          code: "TENANT_ACCESS_DISABLED",
          message:
            "This tenant is inactive, expired, or has a payment issue. Contact the platform administrator.",
        },
      });
    }
    // Role changes and membership revocation take effect without waiting for JWT expiry.
    auth.tenantRole = membership.role;
    next();
  } catch (error) {
    next(error);
  }
}
