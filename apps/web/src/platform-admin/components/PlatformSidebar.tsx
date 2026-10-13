import { Building2, Layers3, LayoutDashboard, LogOut, ShieldCheck, WalletCards } from "lucide-react";
import type { PlatformView, Tenant } from "../types";

type Props = {
  view: PlatformView;
  setView: (view: PlatformView) => void;
  tenants: Tenant[];
  pendingCount: number;
  session: { user: { name: string } };
  onLogout: () => void;
};

export default function PlatformSidebar({ view, setView, tenants, pendingCount, session, onLogout }: Props) {
  return (
          <aside className="platform-sidebar">
            <div className="brand">
              <div className="brand-mark">
                <Building2 size={21} />
              </div>
              <div>
                <strong>
                  savvy<span>.</span>
                </strong>
                <small>SAAS CONTROL PLANE</small>
              </div>
            </div>
            <div className="platform-workspace-switch">
              <div className="platform-switch-icon">
                <ShieldCheck size={17} />
              </div>
              <div>
                <b>Savvy Platform</b>
                <small>Parent administration</small>
              </div>
              <span className="platform-live-dot" />
            </div>
            <div className="platform-label">PLATFORM MANAGEMENT</div>
            <button
              className={`platform-nav ${view === "overview" ? "active" : ""}`}
              onClick={() => setView("overview")}
            >
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </button>
            <button
              className={`platform-nav ${view === "tenants" ? "active" : ""}`}
              onClick={() => setView("tenants")}
            >
              <Building2 size={18} />
              <span>Tenant workspaces</span>
              <span className="nav-count">{tenants.length}</span>
            </button>
            <button
              className={`platform-nav ${view === "payments" ? "active" : ""}`}
              onClick={() => setView("payments")}
            >
              <WalletCards size={18} />
              <span>Payment review</span>
              {pendingCount > 0 && (
                <span className="nav-count alert-count">{pendingCount}</span>
              )}
            </button>
            <div className="platform-sidebar-spacer" />
            <div className="platform-security-card">
              <div className="security-icon">
                <ShieldCheck size={17} />
              </div>
              <div>
                <b>Tenant isolation enabled</b>
                <span>
                  Platform controls are separated from customer workspaces.
                </span>
              </div>
            </div>
            <div className="platform-profile">
              <div className="avatar">
                {(session.user.name || "SA")
                  .split(/\s+/)
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <b>{session.user.name}</b>
                <small>Platform super admin</small>
              </div>
              <button onClick={onLogout} title="Sign out" aria-label="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          </aside>
  );
}
