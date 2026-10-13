import { ChevronRight, RefreshCw } from "lucide-react";
import type { PlatformView } from "../types";

type Props = {
  view: PlatformView;
  viewTitles: Record<PlatformView, string>;
  loading: boolean;
  onRefresh: () => void;
  session: { user: { name: string } };
};

export default function PlatformTopbar({ view, viewTitles, loading, onRefresh, session }: Props) {
  return (
            <header className="platform-topbar">
              <div className="platform-breadcrumb">
                <span>Control plane</span>
                <ChevronRight size={14} />
                <strong>{viewTitles[view]}</strong>
              </div>
              <div className="platform-top-actions">
                <span className="system-live">
                  <i /> Platform console
                </span>
                <button
                  className="platform-refresh"
                  onClick={() => onRefresh()}
                  disabled={loading}
                >
                  <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
                  <span>Refresh</span>
                </button>
                <div className="platform-top-avatar">
                  {(session.user.name || "SA")
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
              </div>
            </header>
  );
}
