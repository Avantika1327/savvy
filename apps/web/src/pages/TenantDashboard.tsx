import { useMemo, useState } from "react";

import DashboardStatCard from "../components/workspace/DashboardStatCard";
import OperationsChart from "../components/workspace/OperationsChart";
import PlantPerformanceCard from "../components/workspace/PlantPerformanceCard";
import RecentOrdersCard from "../components/workspace/RecentOrdersCard";
import WelcomeHeader from "../components/workspace/WelcomeHeader";
import WorkspaceSidebar from "../components/workspace/WorkspaceSidebar";
import WorkspaceTopbar from "../components/workspace/WorkspaceTopbar";

import {
  dashboardStats,
  demoOrders,
} from "../data/dashboardData";

import type { WorkspacePage } from "../types/dashboard";

type Props = {
  onLogout: () => void;
  tenantName: string;
  userName: string;
};

export default function TenantDashboard({
  onLogout,
  tenantName,
  userName,
}: Props) {
  const [active, setActive] =
    useState<WorkspacePage>("Dashboards");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return demoOrders;
    }

    return demoOrders.filter((order) =>
      [
        order.id,
        order.customer,
        order.plant,
        order.quantity,
        order.status,
      ].some((field) =>
        field.toLowerCase().includes(query),
      ),
    );
  }, [search]);

  return (
    <div className="shell">
      <WorkspaceSidebar
        tenantName={tenantName}
        userName={userName}
        active={active}
        mobileOpen={mobileOpen}
        onNavigate={setActive}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={onLogout}
      />

      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="main">
        <WorkspaceTopbar
          active={active}
          searchValue={search}
          onSearchChange={setSearch}
          onToggleMobile={() =>
            setMobileOpen((current) => !current)
          }
        />

        <section className="content">
          <WelcomeHeader
            active={active}
            onCreateOrder={() => setActive("Orders")}
          />

          <div className="stat-grid">
            {dashboardStats.map((stat) => (
              <DashboardStatCard
                key={stat.label}
                stat={stat}
              />
            ))}
          </div>

          <div className="section-grid">
            <OperationsChart />
            <PlantPerformanceCard />
          </div>

          <RecentOrdersCard
            orders={filteredOrders}
            search={search}
            onSearchChange={setSearch}
            onViewAll={setActive}
          />

          <footer>
            © {new Date().getFullYear()} Savvy Operations
            <span>
              Built for smoother operations{" "}
              <span className="footer-heart">✦</span>
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}