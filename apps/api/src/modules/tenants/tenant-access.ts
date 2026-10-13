import { SubscriptionStatus, TenantStatus } from "@prisma/client";

type AccessState = {
  status: TenantStatus;
  subscription: {
    status: SubscriptionStatus;
    trialEndsAt: Date | null;
    currentPeriodEndsAt: Date | null;
  } | null;
};

/** One policy used consistently at login and on every protected tenant request. */
export function tenantAccessAllowed(
  tenant: AccessState,
  now = new Date(),
): boolean {
  if (!tenant.subscription) return false;
  if (
    tenant.status === TenantStatus.SUSPENDED ||
    tenant.status === TenantStatus.INACTIVE ||
    tenant.status === TenantStatus.PAYMENT_PENDING ||
    tenant.status === TenantStatus.EXPIRED
  )
    return false;

  if (tenant.status === TenantStatus.TRIAL) {
    return (
      tenant.subscription.status === SubscriptionStatus.TRIAL &&
      tenant.subscription.trialEndsAt !== null &&
      tenant.subscription.trialEndsAt > now
    );
  }

  return (
    tenant.status === TenantStatus.ACTIVE &&
    tenant.subscription.status === SubscriptionStatus.ACTIVE &&
    tenant.subscription.currentPeriodEndsAt !== null &&
    tenant.subscription.currentPeriodEndsAt > now
  );
}

export function effectiveTenantStatus(
  tenant: AccessState,
  now = new Date(),
): TenantStatus {
  if (
    tenant.status === TenantStatus.SUSPENDED ||
    tenant.status === TenantStatus.INACTIVE ||
    tenant.status === TenantStatus.PAYMENT_PENDING
  )
    return tenant.status;
  if (tenant.status === TenantStatus.TRIAL) {
    return tenantAccessAllowed(tenant, now)
      ? TenantStatus.TRIAL
      : TenantStatus.EXPIRED;
  }
  if (tenant.status === TenantStatus.ACTIVE) {
    if (tenantAccessAllowed(tenant, now)) return TenantStatus.ACTIVE;
    if (
      tenant.subscription?.status === SubscriptionStatus.PAST_DUE ||
      tenant.subscription?.status === SubscriptionStatus.PAYMENT_PENDING
    )
      return TenantStatus.PAYMENT_PENDING;
    if (tenant.subscription?.status === SubscriptionStatus.SUSPENDED)
      return TenantStatus.SUSPENDED;
    if (tenant.subscription?.status === SubscriptionStatus.CANCELLED)
      return TenantStatus.INACTIVE;
    return TenantStatus.EXPIRED;
  }
  return TenantStatus.EXPIRED;
}
