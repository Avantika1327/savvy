import type {
  ConfigurableMembershipRole,
  RolePermissionSetting,
  TenantForm,
  TenantModule,
  TenantStatus,
} from "./types";

export const tenantModules: { value: TenantModule; label: string; description: string }[] = [
  { value: "PLANTS", label: "Plants", description: "Plant locations and operations" },
  { value: "DRIVERS", label: "Drivers", description: "Driver records and assignments" },
  { value: "CUSTOMERS", label: "Customers", description: "Customer records and contacts" },
  { value: "VENDORS", label: "Vendors", description: "Vendor directory and contacts" },
  { value: "DISTRIBUTORS", label: "Distributors", description: "Distributor orders and inventory" },
];

export const configurableRoles: {
  value: ConfigurableMembershipRole;
  label: string;
  description: string;
}[] = [
  { value: "TENANT_ADMIN", label: "Tenant admin", description: "Manages day-to-day workspace operations" },
  { value: "MANAGER", label: "Manager", description: "Can operate modules but cannot delete records by default" },
  { value: "STAFF", label: "Staff", description: "Read-only access by default" },
];

export function createDefaultRolePermissions(modules: TenantModule[] = tenantModules.map((module) => module.value)): RolePermissionSetting[] {
  return modules.flatMap((module) => configurableRoles.map(({ value: role }) => ({
    role,
    module,
    canView: true,
    canCreate: role !== "STAFF",
    canEdit: role !== "STAFF",
    canDelete: role === "TENANT_ADMIN",
  })));
}

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
  enabledModules: tenantModules.map((module) => module.value),
  rolePermissions: createDefaultRolePermissions(),
};

export const statusLabels: Record<TenantStatus, string> = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PAYMENT_PENDING: "Payment pending",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
};
