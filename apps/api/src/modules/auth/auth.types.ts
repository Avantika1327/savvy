import type { PlatformRole, MembershipRole } from "@prisma/client";
export type AuthSurface = "platform" | "web" | "app";
export interface AuthPrincipal {
  userId: number;
  platformRole: PlatformRole;
  surface: AuthSurface;
  tenantId?: string;
  tenantRole?: MembershipRole;
}
