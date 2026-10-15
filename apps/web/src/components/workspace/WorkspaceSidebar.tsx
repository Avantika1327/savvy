import {
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  Droplets,
  Factory,
} from "lucide-react";

import { workspaceNavigation } from "../../data/dashboardData";
import type { WorkspacePage } from "../../types/dashboard";

type Props = {
  tenantName: string;
  userName: string;
  active: WorkspacePage;
  mobileOpen: boolean;
  onNavigate: (page: WorkspacePage) => void;
  onCloseMobile: () => void;
  onLogout: () => void;
};

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

export default function WorkspaceSidebar({
  tenantName,
  userName,
  active,
  mobileOpen,
  onNavigate,
  onCloseMobile,
  onLogout,
}: Props) {
  return (
    <aside className={`sidebar ${mobileOpen ? "show" : ""}`}>
      <div className="brand">
        <div className="brand-mark">
          <Droplets size={22} />
        </div>

        <div>
          <strong>
            savvy<span>.</span>
          </strong>
          <small>OPERATIONS PLATFORM</small>
        </div>
      </div>

      <div className="workspace">
        <div className="plant-icon">
          <Factory size={18} />
        </div>

        <div>
          <b>{tenantName}</b>
          <small>Tenant workspace</small>
        </div>

        <ChevronDown size={16} className="muted" />
      </div>

      {workspaceNavigation.map((group) => (
        <div className="nav-group" key={group.section}>
          <p>{group.section}</p>

          {group.items.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onNavigate(label);
                onCloseMobile();
              }}
              className={`nav-item ${
                active === label ? "active" : ""
              }`}
              aria-current={
                active === label ? "page" : undefined
              }
            >
              <Icon size={18} />
              <span>{label}</span>

              {label === "Raw Materials Stock" && (
                <i aria-label="3 alerts">3</i>
              )}
            </button>
          ))}
        </div>
      ))}

      <div className="sidebar-bottom">
        <div className="help">
          <CircleHelp size={19} />

          <div>
            <b>Need a hand?</b>
            <small>Visit the help centre</small>
          </div>

          <ArrowUpRight size={15} />
        </div>

        <div className="user">
          <div className="avatar">{initials(userName)}</div>

          <div>
            <b>{userName}</b>
            <small>Workspace account</small>
          </div>

          <button
            className="logout-mini"
            type="button"
            onClick={onLogout}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}