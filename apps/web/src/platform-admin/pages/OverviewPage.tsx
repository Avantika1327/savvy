import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Layers3,
  Plus,
  Power,
} from "lucide-react";
import type { Tenant, TenantStatus } from "../types";

type Props = {
  loading: boolean;
  tenants: Tenant[];
  planBreakdown: { plan: string; count: number }[];
  activeCount: number;
  trialCount: number;
  pendingCount: number;
  restrictedCount: number;
  attentionTenants: Tenant[];
  recentTenants: Tenant[];
  statusLabels: Record<TenantStatus, string>;
  onOpenTenant: (tenant: Tenant) => void;
  onOpenPaymentReview: () => void;
  onOpenTenants: () => void;
  onCreateTenant: () => void;
};

export default function OverviewPage({
  loading,
  tenants,
  planBreakdown,
  activeCount,
  trialCount,
  pendingCount,
  restrictedCount,
  attentionTenants,
  recentTenants,
  statusLabels,
  onOpenTenant,
  onOpenPaymentReview,
  onOpenTenants,
  onCreateTenant,
}: Props) {
  return (
    <>
      <div className="platform-overview-grid">
        <section className="panel portfolio-panel">
          <div className="saas-panel-heading">
            <div>
              <h2>Subscription portfolio</h2>
              <p>How customer workspaces are distributed by plan</p>
            </div>
            <div className="panel-heading-icon">
              <Layers3 size={17} />
            </div>
          </div>
          <div className="portfolio-total">
            <div>
              <span>Registered workspaces</span>
              <strong>{loading ? "—" : tenants.length}</strong>
            </div>
            <span className="portfolio-total-badge">
              <Building2 size={13} /> All plans
            </span>
          </div>
          <div className="plan-breakdown">
            {planBreakdown.map((item, i) => {
              const percent = tenants.length
                ? Math.round((item.count / tenants.length) * 100)
                : 0;
              return (
                <div className="plan-breakdown-row" key={item.plan}>
                  <div className="plan-breakdown-label">
                    <span className={`plan-dot plan-dot-${i}`} />
                    <b>
                      {item.plan.charAt(0) + item.plan.slice(1).toLowerCase()}
                    </b>
                    <span>
                      {item.count}{" "}
                      {item.count === 1 ? "workspace" : "workspaces"}
                    </span>
                    <strong>{percent}%</strong>
                  </div>
                  <div className="plan-track">
                    <div
                      className={`plan-fill plan-fill-${i}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="portfolio-foot">
            <div>
              <span className="foot-indicator active-indicator" />
              <span>Active</span>
              <b>{activeCount}</b>
            </div>
            <div>
              <span className="foot-indicator trial-indicator" />
              <span>Trial</span>
              <b>{trialCount}</b>
            </div>
            <div>
              <span className="foot-indicator issue-indicator" />
              <span>Needs attention</span>
              <b>{pendingCount + restrictedCount}</b>
            </div>
          </div>
          <p className="mrr-disclaimer">
            MRR is an estimate from configured prices for active tenants, with
            annual prices normalized monthly. It is not a payment-reconciliation
            total.
          </p>
        </section>
        <section className="panel attention-panel">
          <div className="saas-panel-heading">
            <div>
              <h2>Needs your attention</h2>
              <p>Workspaces that may need an admin action</p>
            </div>
            <span
              className={`attention-count ${attentionTenants.length ? "has-alert" : ""}`}
            >
              {attentionTenants.length}
            </span>
          </div>
          {attentionTenants.length === 0 ? (
            <div className="attention-empty">
              <div className="attention-empty-icon">
                <CheckCircle2 size={22} />
              </div>
              <b>Everything looks in good shape</b>
              <span>
                No suspended, expired, inactive, or payment-pending workspaces
                in this list.
              </span>
            </div>
          ) : (
            <div className="attention-list">
              {attentionTenants.map((t) => (
                <button
                  className="attention-item"
                  key={t.id}
                  onClick={() => onOpenTenant(t)}
                >
                  <span
                    className={`attention-item-icon ${t.effectiveStatus.toLowerCase()}`}
                  >
                    {t.effectiveStatus === "PAYMENT_PENDING" ? (
                      <CreditCard size={16} />
                    ) : t.effectiveStatus === "SUSPENDED" ? (
                      <Power size={16} />
                    ) : (
                      <Clock3 size={16} />
                    )}
                  </span>
                  <span className="attention-item-copy">
                    <b>{t.name}</b>
                    <small>
                      {t.effectiveStatus === "PAYMENT_PENDING"
                        ? "Payment confirmation required"
                        : t.effectiveStatus === "SUSPENDED"
                          ? "Access has been suspended"
                          : t.effectiveStatus === "EXPIRED"
                            ? "Subscription validity has ended"
                            : "Workspace is inactive"}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          )}
          <button
            className="attention-footer"
            onClick={() => onOpenPaymentReview()}
          >
            Open payment review <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
      <section className="panel recent-workspaces-panel">
        <div className="saas-panel-heading recent-heading">
          <div>
            <h2>Recently added workspaces</h2>
            <p>Latest businesses registered on your platform</p>
          </div>
          <button className="view-all-button" onClick={() => onOpenTenants()}>
            View all workspaces <ArrowUpRight size={14} />
          </button>
        </div>
        {loading ? (
          <div className="recent-empty">Loading workspace data…</div>
        ) : recentTenants.length === 0 ? (
          <div className="recent-empty">
            <div className="empty-building">
              <Building2 size={23} />
            </div>
            <b>Your platform is ready for its first customer</b>
            <span>
              Create a tenant workspace to get started with your SaaS business.
            </span>
            <button
              className="primary-btn"
              onClick={() => {
                onCreateTenant();
              }}
            >
              {" "}
              <Plus size={15} /> Create first customer
            </button>
          </div>
        ) : (
          <div className="recent-workspace-list">
            {recentTenants.map((t) => (
              <div className="recent-workspace-row" key={t.id}>
                <div className="recent-company-icon">
                  <Building2 size={17} />
                </div>
                <div className="recent-company-name">
                  <b>{t.name}</b>
                  <small>
                    {t.slug}
                    {t.ownerEmail ? ` · ${t.ownerEmail}` : ""}
                  </small>
                </div>
                <span className={`plan-chip ${t.planCode.toLowerCase()}`}>
                  {t.planCode}
                </span>
                <span
                  className={`tenant-status ${t.effectiveStatus.toLowerCase()}`}
                >
                  <i />
                  {statusLabels[t.effectiveStatus]}
                </span>
                <span className="recent-date">
                  <CalendarDays size={13} />
                  {new Date(t.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <button
                  className="recent-manage"
                  onClick={() => onOpenTenant(t)}
                >
                  Manage <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
