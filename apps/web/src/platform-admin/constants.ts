import type { TenantForm, TenantStatus } from "./types";

export const emptyForm: TenantForm = {
  name: "",
  slug: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  planCode: "STARTER",
  priceAmount: "",
  billingCycle: "MONTHLY",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  trialDays: 14,
};

export const statusLabels: Record<TenantStatus, string> = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PAYMENT_PENDING: "Payment pending",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
};
