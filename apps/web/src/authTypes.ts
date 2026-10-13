export type PlatformRole = "USER" | "SUPER_ADMIN";
export interface Session {
  accessToken?: string;
  user: {
    id: number;
    name: string;
    email: string;
    platformRole: PlatformRole;
    tenantRole?: string;
  };
  tenant?: { id: string; name: string; slug: string; planCode: string };
}
