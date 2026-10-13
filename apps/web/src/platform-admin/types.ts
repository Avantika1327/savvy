import type { LucideIcon } from "lucide-react";

export type TenantStatus =
  | "TRIAL"
  | "ACTIVE"
  | "INACTIVE"
  | "PAYMENT_PENDING"
  | "SUSPENDED"
  | "EXPIRED";

export type PlatformView = "overview" | "tenants" | "payments";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  status: TenantStatus;
  effectiveStatus: TenantStatus;
  planCode: string;
  subscriptionStatus: string;
  billingCycle: string;
  priceAmount: string | null;
  currency: string;
  createdAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  memberCount: number;
};

export type Payment = {
  id: string;
  amount: string;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED";
  method: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  confirmedAt: string | null;
  createdBy: { name: string; email: string };
  confirmedBy: { name: string; email: string } | null;
};

export type TenantForm = {
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planCode: "STARTER" | "GROWTH" | "ENTERPRISE";
  priceAmount: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  trialDays: number;
};

export type PlatformMetric = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  color: string;
};
