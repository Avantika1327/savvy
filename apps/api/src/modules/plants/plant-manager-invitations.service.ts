import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { MembershipRole, PlatformRole } from "@prisma/client";
import { withPlatformTransaction } from "../../lib/platform-transaction.js";
import {
  isSmtpConfigured,
  sendPlantManagerInvitationEmail,
} from "../../lib/email.service.js";

const INVITATION_LIFETIME_MS = 48 * 60 * 60 * 1000;

export type InvitationErrorCode =
  | "INVITATION_INVALID_OR_EXPIRED"
  | "INVITATION_EMAIL_NOT_CONFIGURED"
  | "INVITATION_PASSWORD_REQUIRED"
  | "INVITATION_PASSWORD_TOO_LONG"
  | "INVITATION_PLATFORM_ACCOUNT"
  | "INVITATION_PLANT_UNAVAILABLE";

export class PlantManagerInvitationError extends Error {
  constructor(public readonly code: InvitationErrorCode) {
    super(code);
    this.name = "PlantManagerInvitationError";
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getFrontendOrigin(): string {
  const value =
    process.env.WEB_ORIGIN?.split(",")[0]?.trim() || "http://localhost:5173";
  return value.replace(/\/$/, "");
}

function tokenFromRaw(rawToken: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return null;
  return hashToken(rawToken);
}

function inviteUrl(rawToken: string): string {
  const url = new URL("/accept-plant-invitation", `${getFrontendOrigin()}/`);
  url.searchParams.set("token", rawToken);
  return url.toString();
}

export type InvitationSendResult =
  | { sent: true; expiresAt: string }
  | {
      sent: false;
      code: "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED";
      message: string;
    };

export async function sendPlantManagerInvitation(input: {
  tenantId: string;
  plantId: number;
  plantName: string;
  managerName: string | null;
  managerEmail: string;
  createdByUserId: number;
}): Promise<InvitationSendResult> {
  const email = input.managerEmail.trim().toLowerCase();
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      code: "EMAIL_NOT_CONFIGURED",
      message:
        "Plant was saved, but email is not configured. Configure SMTP and send the invitation again.",
    };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
  const managerName =
    input.managerName?.trim() || email.split("@")[0] || "Plant Manager";

  const workspace = await withPlatformTransaction(async (tx) => {
    await tx.plantManagerInvitation.updateMany({
      where: {
        tenantId: input.tenantId,
        plantId: input.plantId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await tx.plantManagerInvitation.create({
      data: {
        tenantId: input.tenantId,
        plantId: input.plantId,
        managerName,
        email,
        tokenHash,
        expiresAt,
        createdByUserId: input.createdByUserId,
      },
    });

    const tenant = await tx.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true, slug: true },
    });
    if (!tenant)
      throw new PlantManagerInvitationError("INVITATION_PLANT_UNAVAILABLE");
    return tenant;
  });

  try {
    await sendPlantManagerInvitationEmail({
      to: email,
      managerName,
      plantName: input.plantName,
      tenantName: workspace.name,
      tenantSlug: workspace.slug,
      inviteUrl: inviteUrl(rawToken),
      expiresAt,
    });
    return { sent: true, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    // Never keep an active invitation when its email could not be delivered.
    await withPlatformTransaction((tx) =>
      tx.plantManagerInvitation.updateMany({
        where: { tokenHash, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
    console.error("Plant Manager invitation email could not be sent:", error);
    return {
      sent: false,
      code: "EMAIL_SEND_FAILED",
      message:
        "Plant was saved, but the invitation email could not be sent. Check SMTP settings and retry the invitation.",
    };
  }
}

export async function revokePendingPlantManagerInvitations(
  tenantId: string,
  plantId: number,
): Promise<void> {
  await withPlatformTransaction((tx) =>
    tx.plantManagerInvitation.updateMany({
      where: { tenantId, plantId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  );
}

export async function getPlantManagerInvitation(rawToken: string) {
  const tokenHash = tokenFromRaw(rawToken);
  if (!tokenHash)
    throw new PlantManagerInvitationError("INVITATION_INVALID_OR_EXPIRED");

  return withPlatformTransaction(async (tx) => {
    const invitation = await tx.plantManagerInvitation.findUnique({
      where: { tokenHash },
    });
    const now = new Date();
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= now
    ) {
      throw new PlantManagerInvitationError("INVITATION_INVALID_OR_EXPIRED");
    }

    // Plant rows use tenant RLS, so set tenant context on this same transaction
    // after obtaining a valid, high-entropy invitation token.
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${invitation.tenantId}, true)`;
    const [plant, tenant, existingUser] = await Promise.all([
      tx.plant.findFirst({
        where: {
          id: invitation.plantId,
          tenantId: invitation.tenantId,
          deletedAt: null,
        },
        select: { name: true },
      }),
      tx.tenant.findUnique({
        where: { id: invitation.tenantId },
        select: { name: true, slug: true },
      }),
      tx.user.findUnique({
        where: { email: invitation.email },
        select: { id: true, platformRole: true },
      }),
    ]);

    if (
      !plant ||
      !tenant ||
      existingUser?.platformRole === PlatformRole.SUPER_ADMIN
    ) {
      throw new PlantManagerInvitationError(
        existingUser?.platformRole === PlatformRole.SUPER_ADMIN
          ? "INVITATION_PLATFORM_ACCOUNT"
          : "INVITATION_PLANT_UNAVAILABLE",
      );
    }

    return {
      managerName: invitation.managerName,
      email: invitation.email,
      plantName: plant.name,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      expiresAt: invitation.expiresAt.toISOString(),
      existingAccount: Boolean(existingUser),
    };
  });
}

export async function acceptPlantManagerInvitation(input: {
  token: string;
  password?: string;
}) {
  const tokenHash = tokenFromRaw(input.token);
  if (!tokenHash)
    throw new PlantManagerInvitationError("INVITATION_INVALID_OR_EXPIRED");

  const now = new Date();
  const password = input.password;
  if (password && Buffer.byteLength(password, "utf8") > 72) {
    throw new PlantManagerInvitationError("INVITATION_PASSWORD_TOO_LONG");
  }
  const newPasswordHash = password ? await bcrypt.hash(password, 12) : null;

  return withPlatformTransaction(async (tx) => {
    const invitation = await tx.plantManagerInvitation.findUnique({
      where: { tokenHash },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= now
    ) {
      throw new PlantManagerInvitationError("INVITATION_INVALID_OR_EXPIRED");
    }

    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${invitation.tenantId}, true)`;

    const plant = await tx.plant.findFirst({
      where: {
        id: invitation.plantId,
        tenantId: invitation.tenantId,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (!plant)
      throw new PlantManagerInvitationError("INVITATION_PLANT_UNAVAILABLE");

    const existingUser = await tx.user.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser?.platformRole === PlatformRole.SUPER_ADMIN) {
      throw new PlantManagerInvitationError("INVITATION_PLATFORM_ACCOUNT");
    }
    if (!existingUser && !newPasswordHash) {
      throw new PlantManagerInvitationError("INVITATION_PASSWORD_REQUIRED");
    }

    // Atomically claim the token; the whole transaction rolls back if any later
    // operation fails, preventing a partial account or membership.
    const claimed = await tx.plantManagerInvitation.updateMany({
      where: {
        id: invitation.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { acceptedAt: now },
    });
    if (claimed.count !== 1) {
      throw new PlantManagerInvitationError("INVITATION_INVALID_OR_EXPIRED");
    }

    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          name: invitation.managerName,
          email: invitation.email,
          password: newPasswordHash!,
          role: "plant-manager",
          platformRole: PlatformRole.USER,
          emailVerifiedAt: now,
        },
      }));

    const currentMembership = await tx.tenantMembership.findUnique({
      where: {
        userId_tenantId: { userId: user.id, tenantId: invitation.tenantId },
      },
    });
    const membershipRole =
      currentMembership &&
      (currentMembership.role === MembershipRole.TENANT_OWNER ||
        currentMembership.role === MembershipRole.TENANT_ADMIN)
        ? currentMembership.role
        : MembershipRole.MANAGER;

    if (currentMembership) {
      await tx.tenantMembership.update({
        where: {
          userId_tenantId: { userId: user.id, tenantId: invitation.tenantId },
        },
        data: { role: membershipRole, isActive: true },
      });
    } else {
      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: invitation.tenantId,
          role: MembershipRole.MANAGER,
          isActive: true,
        },
      });
    }

    await tx.plant.update({
      where: { id: plant.id },
      data: {
        managerId: user.id,
        manager: invitation.managerName,
        managerEmail: invitation.email,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        tenantId: invitation.tenantId,
        action: "PLANT_MANAGER_INVITATION_ACCEPTED",
        entityType: "Plant",
        entityId: String(plant.id),
        metadata: { email: invitation.email },
      },
    });

    const tenant = await tx.tenant.findUnique({
      where: { id: invitation.tenantId },
      select: { name: true, slug: true },
    });
    if (!tenant)
      throw new PlantManagerInvitationError("INVITATION_PLANT_UNAVAILABLE");

    return {
      managerName: user.name,
      email: user.email,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      existingAccount: Boolean(existingUser),
    };
  });
}

// Exported for a focused verification check in development scripts if needed.
export async function invitationExistsForToken(
  rawToken: string,
): Promise<boolean> {
  const tokenHash = tokenFromRaw(rawToken);
  if (!tokenHash) return false;
  return withPlatformTransaction(async (tx) => {
    const row = await tx.plantManagerInvitation.findUnique({
      where: { tokenHash },
      select: { id: true, acceptedAt: true, revokedAt: true, expiresAt: true },
    });
    return Boolean(
      row && !row.acceptedAt && !row.revokedAt && row.expiresAt > new Date(),
    );
  });
}
