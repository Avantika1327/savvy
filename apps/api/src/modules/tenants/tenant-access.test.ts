import test from "node:test";
import assert from "node:assert/strict";
import { SubscriptionStatus, TenantStatus } from "@prisma/client";
import { effectiveTenantStatus, tenantAccessAllowed } from "./tenant-access.js";
const now = new Date("2026-10-13T10:00:00.000Z");
const sub = (
  status: SubscriptionStatus,
  trialEndsAt: Date | null,
  currentPeriodEndsAt: Date | null,
) => ({ status, trialEndsAt, currentPeriodEndsAt });
test("valid trial permits access only before trial expiry", () => {
  assert.equal(
    tenantAccessAllowed(
      {
        status: TenantStatus.TRIAL,
        subscription: sub(
          SubscriptionStatus.TRIAL,
          new Date("2026-10-14T00:00:00.000Z"),
          null,
        ),
      },
      now,
    ),
    true,
  );
  assert.equal(
    tenantAccessAllowed(
      {
        status: TenantStatus.TRIAL,
        subscription: sub(
          SubscriptionStatus.TRIAL,
          new Date("2026-10-12T00:00:00.000Z"),
          null,
        ),
      },
      now,
    ),
    false,
  );
});
test("active subscription needs a future end date", () => {
  assert.equal(
    tenantAccessAllowed(
      {
        status: TenantStatus.ACTIVE,
        subscription: sub(
          SubscriptionStatus.ACTIVE,
          null,
          new Date("2026-11-13T00:00:00.000Z"),
        ),
      },
      now,
    ),
    true,
  );
  assert.equal(
    tenantAccessAllowed(
      {
        status: TenantStatus.ACTIVE,
        subscription: sub(SubscriptionStatus.ACTIVE, null, null),
      },
      now,
    ),
    false,
  );
});
test("missing subscription and absent expiry fail closed", () => {
  assert.equal(
    tenantAccessAllowed(
      { status: TenantStatus.ACTIVE, subscription: null },
      now,
    ),
    false,
  );
  assert.equal(
    effectiveTenantStatus(
      {
        status: TenantStatus.TRIAL,
        subscription: sub(SubscriptionStatus.TRIAL, null, null),
      },
      now,
    ),
    TenantStatus.EXPIRED,
  );
});
test("suspension and pending payment block access", () => {
  assert.equal(
    tenantAccessAllowed(
      {
        status: TenantStatus.SUSPENDED,
        subscription: sub(
          SubscriptionStatus.ACTIVE,
          null,
          new Date("2026-11-13T00:00:00.000Z"),
        ),
      },
      now,
    ),
    false,
  );
  assert.equal(
    tenantAccessAllowed(
      {
        status: TenantStatus.PAYMENT_PENDING,
        subscription: sub(SubscriptionStatus.PAYMENT_PENDING, null, null),
      },
      now,
    ),
    false,
  );
  assert.equal(
    effectiveTenantStatus(
      {
        status: TenantStatus.ACTIVE,
        subscription: sub(
          SubscriptionStatus.PAST_DUE,
          null,
          new Date("2026-11-13T00:00:00.000Z"),
        ),
      },
      now,
    ),
    TenantStatus.PAYMENT_PENDING,
  );
});
