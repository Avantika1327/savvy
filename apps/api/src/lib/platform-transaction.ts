import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/** Set platform-only RLS context on the same connection as the platform-table queries. */
export function withPlatformTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.platform_admin', 'true', true)`;
    return work(tx);
  });
}
