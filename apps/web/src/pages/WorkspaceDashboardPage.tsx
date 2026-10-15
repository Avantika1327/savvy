import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardStatCard from "../components/workspace/DashboardStatCard";
import OperationsChart from "../components/workspace/OperationsChart";
import PlantPerformanceCard from "../components/workspace/PlantPerformanceCard";
import RecentOrdersCard from "../components/workspace/RecentOrdersCard";
import WelcomeHeader from "../components/workspace/WelcomeHeader";
import {
  dashboardStats,
  demoOrders,
  workspaceUrl,
} from "../data/dashboardData";
import type { WorkspacePage } from "../types/dashboard";

export default function WorkspaceDashboardPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return demoOrders;
    return demoOrders.filter((order) =>
      [
        order.id,
        order.customer,
        order.plant,
        order.quantity,
        order.status,
      ].some((field) => field.toLowerCase().includes(query)),
    );
  }, [search]);

  const openPage = (page: WorkspacePage) => navigate(workspaceUrl(page));

  return (
    <>
      <WelcomeHeader
        active="Dashboards"
        onCreateOrder={() => openPage("Orders")}
      />
      <div className="stat-grid">
        {dashboardStats.map((stat) => (
          <DashboardStatCard key={stat.label} stat={stat} />
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
        onViewAll={openPage}
      />
      <footer>
        © {new Date().getFullYear()} Savvy Operations
        <span>
          Built for smoother operations <span className="footer-heart">✦</span>
        </span>
      </footer>
    </>
  );
}
