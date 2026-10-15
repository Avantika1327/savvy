import type { LucideIcon } from "lucide-react";

/** Roles supported by the Savvy workspace navigation. */
export type WorkspaceRole = "admin" | "vendor" | "plant-manager" | "staff";

/** Stable identifiers used by navigation items and URL helpers. */
export type WorkspaceModuleKey =
  | "dashboard"
  | "plants"
  | "routes"
  | "drivers"
  | "products"
  | "customers"
  | "dispensary"
  | "orders"
  | "orders-request"
  | "maintenance"
  | "vendor"
  | "raw-materials-stock"
  | "reasons"
  | "reports"
  | "lab-reports"
  | "distributor";

/** Display labels shown in the workspace sidebar. */
export type WorkspacePage =
  | "Dashboards"
  | "Plants"
  | "Routes"
  | "Drivers"
  | "Products"
  | "Customers"
  | "Dispensary"
  | "Orders"
  | "Orders Request"
  | "Maintenance"
  | "Vendor"
  | "Raw Materials Stock"
  | "Reasons"
  | "Overall Reports"
  | "Lab Reports"
  | "Distributor";

export type WorkspaceNavItem = {
  key: WorkspaceModuleKey;
  label: WorkspacePage;
  /** Original Laravel URL segment; an empty string represents /workspace. */
  route: string;
  icon: LucideIcon;
  description: string;
  roles: WorkspaceRole[];
};

export type WorkspaceNavGroup = {
  section: string;
  roles: WorkspaceRole[];
  items: WorkspaceNavItem[];
};

export type DashboardStat = {
  label: string;
  value: string;
  change: string;
  up: boolean;
  color: string;
  note: string;
  icon: LucideIcon;
};

export type DashboardOrder = {
  id: string;
  customer: string;
  plant: string;
  quantity: string;
  status: "In production" | "Pending" | "Dispatched";
};

export type PlantStatus = {
  name: string;
  state: string;
  tone: "good" | "warn";
};
