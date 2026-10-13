export type PlatformRole = "USER" | "SUPER_ADMIN";

/** Display/session metadata only. This object is not an authorization credential. */
export interface Session {
  user: {
    id: number;
    name: string;
    email: string;
    platformRole: PlatformRole;
    tenantRole?: string;
  };
  tenant?: { id: string; name: string; slug: string; planCode: string };
}
