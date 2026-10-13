import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, PlatformRole } from "@prisma/client";

const prisma = new PrismaClient();
const SUPER_ADMIN_NAME = "Savvy Platform Admin";
const SUPER_ADMIN_EMAIL = "superadmin@gmail.com";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";

async function main() {
  const name = SUPER_ADMIN_NAME?.trim();
  const email = SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password || password.length < 12) {
    throw new Error(
      "Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and a unique SUPER_ADMIN_PASSWORD of at least 12 characters in your .env file.",
    );
  }

  if (password.startsWith("CHANGE-ME")) {
    throw new Error("Replace the placeholder super-admin password.");
  }

  const hash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hash,
      platformRole: PlatformRole.SUPER_ADMIN,
      role: "platform_super_admin",
    },
    create: {
      name,
      email,
      password: hash,
      platformRole: PlatformRole.SUPER_ADMIN,
      role: "platform_super_admin",
    },
  });

  // Platform super-admin must not belong to a tenant.
  await prisma.tenantMembership.deleteMany({
    where: { userId: admin.id },
  });

  console.log(`Platform super-admin seeded successfully: ${email}`);
}

main()
  .catch((error) => {
    console.error("Super-admin seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
