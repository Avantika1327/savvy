export type PlatformRole = "USER" | "SUPER_ADMIN";

/** Display/session metadata only. Authorization must be enforced by the API. */
export interface Session {
  user: {
    id: number;
    name: string;
    email: string;
    platformRole: PlatformRole;
    /** Legacy Laravel role from the original Savvy app, when the API returns it. */
    role?: string;
    /** SaaS membership role, for example TENANT_OWNER, TENANT_ADMIN, MANAGER or STAFF. */
    tenantRole?: string;
  };
  tenant?: { id: string; name: string; slug: string; planCode: string };
}
