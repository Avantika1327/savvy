import { ArrowLeft, Construction } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { WorkspaceNavItem } from "../types/dashboard";
import { workspaceUrl } from "../data/dashboardData";

type Props = { item: WorkspaceNavItem };

/** Honest placeholder for legacy modules that don't yet have migrated React pages/API handlers. */
export default function WorkspaceModulePage({ item }: Props) {
  const navigate = useNavigate();
  const Icon = item.icon;

  return (
    <section className="workspace-module-page">
      <header className="workspace-module-heading">
        <div className="workspace-module-title-icon">
          <Icon size={21} />
        </div>
        <div>
          <span className="workspace-module-eyebrow">
            SAVVY WORKSPACE · {item.key.toUpperCase()}
          </span>
          <h1>{item.label}</h1>
          <p>{item.description}</p>
        </div>
      </header>
      <div className="workspace-module-state">
        <span className="workspace-module-state-icon">
          <Construction size={24} />
        </span>
        <h2>{item.label} page is not connected yet</h2>
        <p>
          This route is registered and tenant-scoped navigation is ready.
          Connect the module's API and migrated React screens to enable its
          operations.
        </p>
        <button
          className="secondary-btn"
          type="button"
          onClick={() => navigate(workspaceUrl("Dashboards"))}
        >
          <ArrowLeft size={15} /> Back to dashboard
        </button>
      </div>
    </section>
  );
}
