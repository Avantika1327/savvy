import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/** Apply tenant context on the same transaction/connection used for all tenant-scoped queries. */
export function withTenantTransaction<T>(
  tenantId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    await tx.$queryRaw`SELECT set_config('app.platform_admin', 'false', true)`;
    return work(tx);
  });
}
