import { PrismaClient } from "@prisma/client";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const prisma = new PrismaClient();
const defaultCountry = (process.env.PHONE_DEFAULT_COUNTRY ?? "IN") as CountryCode;
const applyChanges = process.argv.includes("--apply");

type Row = { id: string; name: string; contactPhone: string | null };
type PaymentRefRow = { id: string; tenantId: string; reference: string | null };

async function main() {
  // Explicit select keeps the read phase compatible before the new DB column exists.
  const [tenants, paymentReferences]: [Row[], PaymentRefRow[]] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, name: true, contactPhone: true },
    }),
    prisma.payment.findMany({
      where: { reference: { not: null } },
      select: { id: true, tenantId: true, reference: true },
    }),
  ]);

  const invalid: Array<{ id: string; name: string; contactPhone: string }> = [];
  const byE164 = new Map<string, Row[]>();
  const updates: Array<{ id: string; e164: string }> = [];

  for (const tenant of tenants) {
    if (!tenant.contactPhone?.trim()) continue;
    const parsed = parsePhoneNumberFromString(tenant.contactPhone, defaultCountry);
    if (!parsed?.isValid()) {
      invalid.push({ id: tenant.id, name: tenant.name, contactPhone: tenant.contactPhone });
      continue;
    }
    const e164 = parsed.number.toString();
    const group = byE164.get(e164) ?? [];
    group.push(tenant);
    byE164.set(e164, group);
    updates.push({ id: tenant.id, e164 });
  }

  const duplicates = [...byE164.entries()].filter(([, group]) => group.length > 1);
  const referencesByTenant = new Map<string, PaymentRefRow[]>();
  for (const payment of paymentReferences) {
    if (!payment.reference) continue;
    const key = `${payment.tenantId}\u0000${payment.reference}`;
    const group = referencesByTenant.get(key) ?? [];
    group.push(payment);
    referencesByTenant.set(key, group);
  }
  const duplicateReferences = [...referencesByTenant.entries()].filter(([, group]) => group.length > 1);
  if (invalid.length || duplicates.length || duplicateReferences.length) {
    if (invalid.length) {
      console.error("Invalid existing phone numbers; correct them or clear them before migration:");
      for (const row of invalid) console.error(`- ${row.id} | ${row.name} | ${row.contactPhone}`);
    }
    if (duplicates.length) {
      console.error("Duplicate phone numbers normalize to the same E.164 number:");
      for (const [phone, group] of duplicates) {
        console.error(`- ${phone}: ${group.map((row) => `${row.name} (${row.id})`).join(", ")}`);
      }
    }
    if (duplicateReferences.length) {
      console.error("Duplicate payment references within the same tenant:");
      for (const [, group] of duplicateReferences) {
        console.error(`- tenant ${group[0]?.tenantId}, reference ${group[0]?.reference}: payment IDs ${group.map((row) => row.id).join(", ")}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Preflight passed: ${updates.length} tenant phone number(s) are valid and unique; payment references are unique within each tenant.`);
  if (!applyChanges) {
    console.log("No rows changed. After the nullable column migration is applied, rerun with --apply to backfill contactPhoneNormalized.");
    return;
  }

  // Only run --apply after the new nullable field and unique index exist.
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    await prisma.$transaction(
      batch.map(({ id, e164 }) =>
        prisma.tenant.update({
          where: { id },
          data: { contactPhoneNormalized: e164 },
          select: { id: true },
        }),
      ),
    );
  }
  console.log(`Backfilled ${updates.length} normalized phone number(s).`);
}

main()
  .catch((error: unknown) => {
    console.error("Tenant phone preflight/backfill failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
