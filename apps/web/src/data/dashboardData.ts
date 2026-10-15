import {
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  Factory,
  Package,
  Route as RouteIcon,
  Store,
  ClipboardCheck,
  FileText,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

import type {
  DashboardOrder,
  DashboardStat,
  PlantStatus,
  WorkspaceNavGroup,
} from "../types/dashboard";

export const workspaceNavigation: WorkspaceNavGroup[] = [
  {
    section: "MENU",
    items: [
      { label: "Dashboards", icon: ChartNoAxesCombined },
    ],
  },
  {
    section: "CUSTOMERS",
    items: [
      { label: "Plants", icon: Factory },
      { label: "Routes", icon: RouteIcon },
      { label: "Drivers", icon: Truck },
      { label: "Products", icon: Package },
      { label: "Customers", icon: Users },
      { label: "Dispensary", icon: Store },
    ],
  },
  {
    section: "PURCHASES",
    items: [
      { label: "Orders", icon: ClipboardList },
      { label: "Orders Request", icon: ClipboardCheck },
      { label: "Maintenance", icon: Wrench },
    ],
  },
  {
    section: "VENDORS",
    items: [
      { label: "Vendor", icon: Package },
    ],
  },
  {
    section: "STOCK MANAGEMENT",
    items: [
      { label: "Raw Materials Stock", icon: Boxes },
    ],
  },
  {
    section: "SETTINGS",
    items: [
      { label: "Reasons", icon: FileText },
      { label: "Reports", icon: ChartNoAxesCombined },
    ],
  },
];

// Demo data only. Connect real APIs before using these as live metrics.
export const dashboardStats: DashboardStat[] = [
  {
    label: "Total orders",
    value: "1,284",
    change: "+12.8%",
    up: true,
    color: "violet",
    note: "vs. last month",
    icon: ClipboardList,
  },
  {
    label: "Production today",
    value: "8,420",
    change: "+6.4%",
    up: true,
    color: "mint",
    note: "vs. yesterday",
    icon: Factory,
  },
  {
    label: "Low stock alerts",
    value: "12",
    change: "3 new",
    up: false,
    color: "amber",
    note: "needs attention",
    icon: Boxes,
  },
  {
    label: "Open maintenance",
    value: "07",
    change: "−2",
    up: true,
    color: "blue",
    note: "since last week",
    icon: Wrench,
  },
];

export const demoOrders: DashboardOrder[] = [
  {
    id: "#SV-2408",
    customer: "Aarav Distributors",
    plant: "Pune Plant",
    quantity: "2,400 jars",
    status: "In production",
  },
  {
    id: "#SV-2407",
    customer: "Green Valley Stores",
    plant: "Akola Plant",
    quantity: "1,200 jars",
    status: "Pending",
  },
  {
    id: "#SV-2406",
    customer: "FreshDrop Supply",
    plant: "Amravati Plant",
    quantity: "3,600 jars",
    status: "Dispatched",
  },
  {
    id: "#SV-2405",
    customer: "Citywide Retail",
    plant: "Pune Plant",
    quantity: "800 jars",
    status: "In production",
  },
  {
    id: "#SV-2404",
    customer: "PureLife Partners",
    plant: "Akola Plant",
    quantity: "1,500 jars",
    status: "Pending",
  },
];

export const productionBars = [
  44, 62, 50, 76, 58, 87, 67, 94, 72, 60, 82, 70,
];

export const productionDayLabels = [
  "1", "3", "5", "7", "9", "11",
  "13", "15", "17", "19", "21", "23",
];

export const plantStatuses: PlantStatus[] = [
  { name: "Pune Plant", state: "Running", tone: "good" },
  { name: "Akola Plant", state: "Running", tone: "good" },
  { name: "Amravati Plant", state: "Review stock", tone: "warn" },
];