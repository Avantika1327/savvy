import type { LucideIcon } from "lucide-react";

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
  | "Reports";

export type WorkspaceNavItem = {
  label: WorkspacePage;
  icon: LucideIcon;
};

export type WorkspaceNavGroup = {
  section: string;
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