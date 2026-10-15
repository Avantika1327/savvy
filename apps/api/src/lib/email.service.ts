import nodemailer from "nodemailer";

type PlantManagerInvitationEmail = {
  to: string;
  managerName: string;
  plantName: string;
  tenantName: string;
  tenantSlug: string;
  inviteUrl: string;
  expiresAt: Date;
};

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_PORT?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim() &&
    process.env.MAIL_FROM?.trim(),
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendPlantManagerInvitationEmail(
  input: PlantManagerInvitationEmail,
): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.",
    );
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE?.toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      // Gmail App Passwords are often displayed with spaces; remove formatting spaces.
      pass: process.env.SMTP_PASS?.replace(/\s/g, ""),
    },
  });

  const managerName = escapeHtml(input.managerName);
  const plantName = escapeHtml(input.plantName);
  const tenantName = escapeHtml(input.tenantName);
  const expires = input.expiresAt.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: input.to,
      subject: `Invitation to manage ${input.plantName} on Savvy`,
      text: [
        `Hello ${input.managerName},`,
        "",
        `You have been invited to manage ${input.plantName} in ${input.tenantName} on Savvy.`,
        `Workspace slug: ${input.tenantSlug}`,
        "",
        "Open this secure link to accept the invitation and set up your account:",
        input.inviteUrl,
        "",
        `This invitation expires at ${expires} (India time).`,
        "If you were not expecting this invitation, you can ignore this email.",
      ].join("\n"),
      html: `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">
  <h2>You're invited to Savvy</h2>
  <p>Hello ${managerName},</p>
  <p>You have been invited to manage <strong>${plantName}</strong> in <strong>${tenantName}</strong>.</p>
  <p><strong>Workspace slug:</strong> ${escapeHtml(input.tenantSlug)}</p>
  <p><a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;padding:12px 18px;background:#243b73;color:#fff;text-decoration:none;border-radius:6px">Accept invitation</a></p>
  <p>This secure link expires at ${escapeHtml(expires)} (India time).</p>
  <p>If you were not expecting this invitation, you can ignore this email.</p>
</body></html>`,
    });
  } finally {
    transporter.close();
  }
}
