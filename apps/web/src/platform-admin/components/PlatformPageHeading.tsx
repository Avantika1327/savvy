import {
  Activity,
  ArrowUpRight,
  Layers3,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { PlatformView } from "../types";

type Props = {
  view: PlatformView;
  viewTitles: Record<PlatformView, string>;
  viewDescriptions: Record<PlatformView, string>;
  loading: boolean;
  tenantCount: number;
  onCreate: () => void;
  onOpenTenants: () => void;
  onRefresh: () => void;
};

export default function PlatformPageHeading({
  view,
  viewTitles,
  viewDescriptions,
  loading,
  tenantCount,
  onCreate,
  onOpenTenants,
  onRefresh,
}: Props) {
  return (
    <>
      {view === "overview" ? (
        <div className="saas-hero">
          <div className="saas-hero-copy">
            <div className="saas-hero-kicker">
              <Activity size={14} /> SAAS CONTROL CENTRE{" "}
              <span>LIVE SNAPSHOT</span>
            </div>
            <h1>
              Manage your entire
              <br />
              platform from one place.
            </h1>
            <p>
              Onboard businesses, monitor subscription health, and manage access
              across every customer workspace.
            </p>
            <div className="saas-hero-actions">
              <button
                className="hero-primary"
                onClick={() => {
                  onCreate();
                }}
              >
                <Plus size={16} /> Create customer
              </button>
              <button
                className="hero-secondary"
                onClick={() => onOpenTenants()}
              >
                Explore workspaces <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
          <div className="saas-hero-art" aria-hidden="true">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-orbit orbit-three" />
            <div className="hero-float-card hero-float-main">
              <div className="hero-card-symbol">
                <Layers3 size={17} />
              </div>
              <div>
                <small>WORKSPACES</small>
                <b>{loading ? "—" : tenantCount.toLocaleString("en-IN")}</b>
              </div>
              <span>
                <TrendingUp size={13} />
              </span>
            </div>
            <div className="hero-float-card hero-float-status">
              <i />
              <div>
                <b>{loading ? "Checking platform" : "Control plane ready"}</b>
                <small>Tenant access monitoring</small>
              </div>
            </div>
            <div className="hero-mini-grid">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="hero-bottom-note">
            <ShieldCheck size={14} /> One application · Isolated customer data ·
            Central control
          </div>
        </div>
      ) : (
        <div className="platform-page-heading">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> PLATFORM MANAGEMENT
            </div>
            <h1>{viewTitles[view]}</h1>
            <p>{viewDescriptions[view]}</p>
          </div>
          <div className="platform-page-actions">
            <button
              className="secondary-btn"
              onClick={() => onRefresh()}
              disabled={loading}
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              className="primary-btn"
              onClick={() => {
                onCreate();
              }}
            >
              <Plus size={16} /> Add customer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
