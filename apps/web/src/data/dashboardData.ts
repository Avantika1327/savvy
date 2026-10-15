import {
  Boxes,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileText,
  FlaskConical,
  Package,
  Route as RouteIcon,
  Store,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import type {
  DashboardOrder,
  DashboardStat,
  PlantStatus,
  WorkspaceModuleKey,
  WorkspaceNavGroup,
  WorkspaceNavItem,
  WorkspacePage,
  WorkspaceRole,
} from "../types/dashboard";

const ALL_LEGACY_ROLES: WorkspaceRole[] = ["admin", "vendor", "plant-manager"];
const ADMIN_ONLY: WorkspaceRole[] = ["admin"];

/**
 * Complete Savvy workspace navigation.
 * Keeps the original Laravel URL slugs while adding typed keys,
 * descriptions, and role visibility for the React workspace.
 */
export const workspaceNavigation: WorkspaceNavGroup[] = [
  {
    section: "Menu",
    roles: ALL_LEGACY_ROLES,
    items: [
      {
        key: "dashboard",
        label: "Dashboards",
        route: "",
        icon: ChartNoAxesCombined,
        description:
          "Operational summary, recent orders and plant performance.",
        roles: ALL_LEGACY_ROLES,
      },
    ],
  },
  {
    section: "Customers",
    roles: ALL_LEGACY_ROLES,
    items: [
      {
        key: "plants",
        label: "Plants",
        route: "plant",
        icon: Factory,
        description:
          "Manage plant locations, managers and operational availability.",
        roles: ["admin", "vendor"],
      },
      {
        key: "routes",
        label: "Routes",
        route: "route",
        icon: RouteIcon,
        description:
          "Manage delivery routes and their assigned plants or drivers.",
        roles: ALL_LEGACY_ROLES,
      },
      {
        key: "drivers",
        label: "Drivers",
        route: "driver",
        icon: Truck,
        description: "Manage driver profiles and operational assignments.",
        roles: ALL_LEGACY_ROLES,
      },
      {
        key: "products",
        label: "Products",
        route: "product",
        icon: Package,
        description: "Manage products and their operational details.",
        roles: ADMIN_ONLY,
      },
      {
        key: "customers",
        label: "Customers",
        route: "customer",
        icon: Users,
        description: "Manage customer records and contact details.",
        roles: ALL_LEGACY_ROLES,
      },
      {
        key: "dispensary",
        label: "Dispensary",
        route: "dispensary",
        icon: Store,
        description: "Manage dispensary operations and related records.",
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    section: "Purchases",
    roles: ALL_LEGACY_ROLES,
    items: [
      {
        key: "orders",
        label: "Orders",
        route: "order",
        icon: ClipboardList,
        description: "Manage customer orders and order fulfilment.",
        roles: ALL_LEGACY_ROLES,
      },
      {
        key: "orders-request",
        label: "Orders Request",
        route: "request-order",
        icon: ClipboardCheck,
        description: "Review and process incoming order requests.",
        roles: ADMIN_ONLY,
      },
      {
        key: "maintenance",
        label: "Maintenance",
        route: "maintenance",
        icon: Wrench,
        description: "Track maintenance jobs and equipment servicing.",
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    section: "Vendors",
    roles: ADMIN_ONLY,
    items: [
      {
        key: "vendor",
        label: "Vendor",
        route: "vendor",
        icon: Package,
        description: "Manage vendors and supplier information.",
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    section: "Stock Management",
    roles: ADMIN_ONLY,
    items: [
      {
        key: "raw-materials-stock",
        label: "Raw Materials Stock",
        route: "raw-materials",
        icon: Boxes,
        description: "Track raw materials, stock availability and adjustments.",
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    section: "Settings",
    roles: ADMIN_ONLY,
    items: [
      {
        key: "reasons",
        label: "Reasons",
        route: "reasons",
        icon: FileText,
        description: "Maintain reason codes used by operational workflows.",
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    section: "Reports",
    roles: ADMIN_ONLY,
    items: [
      {
        key: "reports",
        label: "Overall Reports",
        route: "reports",
        icon: ChartNoAxesCombined,
        description: "Review overall operational reports and summaries.",
        roles: ADMIN_ONLY,
      },
      {
        key: "lab-reports",
        label: "Lab Reports",
        route: "lab-reports",
        icon: FlaskConical,
        description: "Review laboratory reports and quality records.",
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    section: "Distributors",
    roles: ADMIN_ONLY,
    items: [
      {
        key: "distributor",
        label: "Distributor",
        route: "distributor",
        icon: Truck,
        description: "Manage distributors and their operational records.",
        roles: ADMIN_ONLY,
      },
    ],
  },
];

export const workspaceItems = workspaceNavigation.flatMap(
  (group) => group.items,
);

/**
 * Resolve the active workspace role.
 * A tenant membership role takes precedence over a legacy global/application role.
 * Unknown roles fall back to least privilege.
 */
export function resolveWorkspaceRole(
  legacyRole?: string,
  tenantRole?: string,
): WorkspaceRole {
  const normalize = (value?: string) =>
    (value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-");

  const membership = normalize(tenantRole);
  const legacy = normalize(legacyRole);

  if (
    [
      "admin",
      "tenant-owner",
      "tenant-admin",
      "owner",
      "tenant-admin-user",
    ].includes(membership)
  ) {
    return "admin";
  }
  if (membership === "vendor") return "vendor";
  if (["plant-manager", "manager"].includes(membership)) return "plant-manager";

  if (
    [
      "admin",
      "tenant-owner",
      "tenant-admin",
      "owner",
      "tenant-admin-user",
    ].includes(legacy)
  ) {
    return "admin";
  }
  if (legacy === "vendor") return "vendor";
  if (["plant-manager", "manager"].includes(legacy)) return "plant-manager";

  return "staff";
}

/** Staff is dashboard-only unless explicit permissions are added later. */
export function canAccessWorkspaceItem(
  item: WorkspaceNavItem,
  role: WorkspaceRole,
): boolean {
  if (role === "staff") return item.key === "dashboard";
  return item.roles.includes(role);
}

export function workspaceNavigationForRole(
  role: WorkspaceRole,
): WorkspaceNavGroup[] {
  return workspaceNavigation
    .filter(
      (group) =>
        group.roles.includes(role) ||
        (role === "staff" && group.section === "Menu"),
    )
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessWorkspaceItem(item, role)),
    }))
    .filter((group) => group.items.length > 0);
}

export function workspaceUrl(
  routeOrPage: string | WorkspacePage | WorkspaceModuleKey,
): string {
  const item = workspaceItems.find(
    (candidate) =>
      candidate.key === routeOrPage ||
      candidate.label === routeOrPage ||
      candidate.route === routeOrPage,
  );

  if (!item || !item.route) return "/workspace";
  return `/workspace/${item.route}`;
}

export function workspacePageForPath(pathname: string): WorkspaceNavItem {
  const cleanPath = pathname.replace(/\/+$/, "") || "/workspace";

  // Keep the earlier plural Plants URL working as an alias.
  if (cleanPath === "/workspace/plants") {
    return (
      workspaceItems.find((item) => item.key === "plants") ?? workspaceItems[0]
    );
  }

  return (
    workspaceItems.find((item) =>
      item.route
        ? cleanPath === `/workspace/${item.route}`
        : cleanPath === "/workspace",
    ) ?? workspaceItems[0]
  );
}

// Demo values only. Replace with API data before representing these as live KPIs.
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

export const productionBars = [44, 62, 50, 76, 58, 87, 67, 94, 72, 60, 82, 70];
export const productionDayLabels = [
  "1",
  "3",
  "5",
  "7",
  "9",
  "11",
  "13",
  "15",
  "17",
  "19",
  "21",
  "23",
];

export const plantStatuses: PlantStatus[] = [
  { name: "Pune Plant", state: "Running", tone: "good" },
  { name: "Akola Plant", state: "Running", tone: "good" },
  { name: "Amravati Plant", state: "Review stock", tone: "warn" },
];
