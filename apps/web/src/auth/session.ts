import type { PlatformRole, Session } from "../authTypes";

const PLATFORM_ROLES: readonly PlatformRole[] = ["USER", "SUPER_ADMIN"];

/**
 * Build a display-only session object from an untrusted value.
 * Access tokens and any unknown fields are deliberately not persisted.
 * Authorization must always be enforced by the API, not by this object.
 */
export function normalizeSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const rawUser = candidate.user;
  if (!rawUser || typeof rawUser !== "object") return null;

  const user = rawUser as Record<string, unknown>;
  const role = user.platformRole;
  if (
    typeof user.id !== "number" ||
    typeof user.name !== "string" ||
    typeof user.email !== "string" ||
    typeof role !== "string" ||
    !PLATFORM_ROLES.includes(role as PlatformRole)
  ) {
    return null;
  }

  const safeSession: Session = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: role as PlatformRole,
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

  // Rewrite older entries so any previously stored accessToken is removed.
  try {
    sessionStorage.setItem("savvy-session", JSON.stringify(safeSession));
  } catch {
    // Storage may be unavailable; the safe session can still be used in memory.
  }
  return safeSession;
}

export function storeSession(value: unknown): Session | null {
  const safeSession = normalizeSession(value);
  if (!safeSession) return null;

  try {
    sessionStorage.setItem("savvy-session", JSON.stringify(safeSession));
  } catch {
    // The in-memory session can still be used if browser storage is unavailable.
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
