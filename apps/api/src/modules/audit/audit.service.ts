import type { Request } from "express";
import { withPlatformTransaction } from "../../lib/platform-transaction.js";

export async function writeAudit(input: {
  actorUserId?: number | null;
  tenantId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}) {
  return withPlatformTransaction((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        tenantId: input.tenantId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata
          ? JSON.parse(JSON.stringify(input.metadata))
          : undefined,
        ipAddress: input.req?.ip,
        userAgent: input.req?.get("user-agent")?.slice(0, 500),
      },
    }),
  );
}
