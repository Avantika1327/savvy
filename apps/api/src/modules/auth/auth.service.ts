import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PlatformRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { tenantAccessAllowed } from "../tenants/tenant-access.js";
import type { AuthPrincipal, AuthSurface } from "./auth.types.js";

function jwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace-with-"))
    throw new Error(
      "JWT_ACCESS_SECRET must be a unique random string of at least 32 characters.",
    );
  return secret;
}
export function issueAccessToken(principal: AuthPrincipal): string {
  return jwt.sign(principal, jwtSecret(), {
    expiresIn: "8h",
    issuer: process.env.JWT_ISSUER ?? "savvy-api",
    audience: process.env.JWT_AUDIENCE ?? "savvy-clients",
  });
}
export function verifyAccessToken(token: string): AuthPrincipal {
  const payload = jwt.verify(token, jwtSecret(), {
    issuer: process.env.JWT_ISSUER ?? "savvy-api",
    audience: process.env.JWT_AUDIENCE ?? "savvy-clients",
  }) as jwt.JwtPayload & AuthPrincipal;
  if (!payload.sub && !payload.userId) throw new Error("Invalid token subject");
  if (
    !Number.isInteger(payload.userId) ||
    !["platform", "web", "app"].includes(payload.surface)
  )
    throw new Error("Invalid token claims");
  return payload;
}

export class LoginError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CREDENTIALS"
      | "PLATFORM_ADMIN_REQUIRED"
      | "SUPER_ADMIN_CANNOT_USE_TENANT"
      | "TENANT_UNAVAILABLE"
      | "TENANT_ACCESS_DENIED",
  ) {
    super(code);
  }
}

export async function loginPlatformAdmin(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    throw new LoginError("INVALID_CREDENTIALS");
  if (user.platformRole !== PlatformRole.SUPER_ADMIN)
    throw new LoginError("PLATFORM_ADMIN_REQUIRED");
  const principal: AuthPrincipal = {
    userId: user.id,
    platformRole: user.platformRole,
    surface: "platform",
  };
  return {
    accessToken: issueAccessToken(principal),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
    },
  };
}

export async function loginTenantUser(input: {
  email: string;
  password: string;
  tenantSlug: string;
  surface: Extract<AuthSurface, "web" | "app">;
}) {
  const email = input.email.trim().toLowerCase();
  const slug = input.tenantSlug.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { tenant: { slug } },
        include: { tenant: { include: { subscription: true } } },
      },
    },
  });
  if (!user || !(await bcrypt.compare(input.password, user.password)))
    throw new LoginError("INVALID_CREDENTIALS");
  if (user.platformRole === PlatformRole.SUPER_ADMIN)
    throw new LoginError("SUPER_ADMIN_CANNOT_USE_TENANT");
  const membership = user.memberships.find((m) => m.isActive);
  if (!membership) throw new LoginError("TENANT_ACCESS_DENIED");
  if (!tenantAccessAllowed(membership.tenant))
    throw new LoginError("TENANT_UNAVAILABLE");
  const principal: AuthPrincipal = {
    userId: user.id,
    platformRole: user.platformRole,
    surface: input.surface,
    tenantId: membership.tenantId,
    tenantRole: membership.role,
  };
  return {
    accessToken: issueAccessToken(principal),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
      tenantRole: membership.role,
    },
    tenant: {
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      planCode: membership.tenant.subscription?.planCode ?? "STARTER",
    },
  };
}
