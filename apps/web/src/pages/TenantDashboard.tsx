import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import WorkspaceSidebar from "../components/workspace/WorkspaceSidebar";
import WorkspaceTopbar from "../components/workspace/WorkspaceTopbar";
import { workspacePageForPath } from "../data/dashboardData";
import type { WorkspaceRole } from "../types/dashboard";

type Props = {
  onLogout: () => void;
  tenantName: string;
  userName: string;
  workspaceRole: WorkspaceRole;
};

export default function TenantDashboard({
  onLogout,
  tenantName,
  userName,
  workspaceRole,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = workspacePageForPath(location.pathname);

  return (
    <div className="shell">
      <WorkspaceSidebar
        tenantName={tenantName}
        userName={userName}
        active={activeItem.label}
        mobileOpen={mobileOpen}
        workspaceRole={workspaceRole}
        onNavigate={navigate}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={onLogout}
      />
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
          active={activeItem.label}
          searchValue=""
          onSearchChange={() => undefined}
          onToggleMobile={() => setMobileOpen((current) => !current)}
          showSearch={false}
        />
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
