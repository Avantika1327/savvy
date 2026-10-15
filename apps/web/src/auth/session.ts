import type { PlatformRole, Session } from "../authTypes";

const PLATFORM_ROLES: readonly PlatformRole[] = ["USER", "SUPER_ADMIN"];

/**
 * Convert untrusted login data into display-only session metadata.
 * Do not persist tokens. Frontend role values control visibility only;
 * API authorization remains the security boundary.
 */
export function normalizeSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const rawUser = candidate.user;
  if (!rawUser || typeof rawUser !== "object") return null;

  const user = rawUser as Record<string, unknown>;
  const platformRole = user.platformRole;
  if (
    typeof user.id !== "number" ||
    typeof user.name !== "string" ||
    typeof user.email !== "string" ||
    typeof platformRole !== "string" ||
    !PLATFORM_ROLES.includes(platformRole as PlatformRole)
  ) {
    return null;
  }

  const safeSession: Session = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: platformRole as PlatformRole,
      ...(typeof user.role === "string" ? { role: user.role } : {}),
      ...(typeof user.tenantRole === "string"
        ? { tenantRole: user.tenantRole }
        : {}),
    },
  };

  const rawTenant = candidate.tenant;
  if (rawTenant && typeof rawTenant === "object") {
    const tenant = rawTenant as Record<string, unknown>;
    if (
      typeof tenant.id === "string" &&
      typeof tenant.name === "string" &&
      typeof tenant.slug === "string" &&
      typeof tenant.planCode === "string"
    ) {
      safeSession.tenant = {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        planCode: tenant.planCode,
      };
    }
  }

  return safeSession;
}

export function readStoredSession(): Session | null {
  let serialized: string | null;
  try {
    serialized = sessionStorage.getItem("savvy-session");
  } catch {
    return null;
  }
  if (!serialized) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    clearStoredSession();
    return null;
  }

  const safeSession = normalizeSession(parsed);
  if (!safeSession) {
    clearStoredSession();
    return null;
  }

  // Rewrite older sessions to remove unexpected fields, including access tokens.
  try {
    sessionStorage.setItem("savvy-session", JSON.stringify(safeSession));
  } catch {
    // Continue in memory if browser storage is unavailable.
  }
  return safeSession;
}

export function storeSession(value: unknown): Session | null {
  const safeSession = normalizeSession(value);
  if (!safeSession) return null;

  try {
    sessionStorage.setItem("savvy-session", JSON.stringify(safeSession));
  } catch {
    // Continue in memory if browser storage is unavailable.
  }
  return safeSession;
}

export function clearStoredSession(): void {
  try {
    sessionStorage.removeItem("savvy-session");
  } catch {
    // Ignore unavailable browser storage during logout.
  }
}
