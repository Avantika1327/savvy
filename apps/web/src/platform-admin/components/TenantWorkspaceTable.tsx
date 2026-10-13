import {
  Building2,
  CalendarDays,
  History,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { PlatformView, Tenant, TenantStatus } from "../types";

type Props = {
  view: PlatformView;
  loading: boolean;
  filtered: Tenant[];
  search: string;
  onSearchChange: (value: string) => void;
  statusLabels: Record<TenantStatus, string>;
  onRefresh: () => void;
  onOpenTenant: (tenant: Tenant) => void;
  onChangeStatus: (tenant: Tenant) => void;
};

export default function TenantWorkspaceTable({
  view,
  loading,
  filtered,
  search,
  onSearchChange,
  statusLabels,
  onRefresh,
  onOpenTenant,
  onChangeStatus,
}: Props) {
  return (
    <section className="panel tenant-table-panel">
      <div className="tenant-table-heading">
        <div>
          <h2>
            {view === "tenants"
              ? "All customer workspaces"

              : "Tenants awaiting payment"}
          </h2>
          <p>
            {view === "tenants"
              ? "Manage tenant details, access status and workspace membership."
              : "These workspaces have an effective payment-pending status. Open a tenant to review its payment history."}
          </p>
        </div>
        <button
          className="secondary-btn"
          onClick={() => onRefresh()}
          disabled={loading}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <div className="tenant-toolbar">
        <div className="search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, workspace or plan…"
          />
        </div>
        <span>
          {filtered.length} workspace{filtered.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="table-scroll">
        <table className="tenant-table">
          <thead>
            <tr>
              <th>CUSTOMER / WORKSPACE</th>
              <th>PLAN</th>
              <th>MEMBERS</th>
              <th>STATUS</th>
              <th>VALID UNTIL</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="tenant-empty">
                  Loading tenant workspaces…
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="tenant-ident">
                      <div className="tenant-avatar">
                        <Building2 size={17} />
                      </div>
                      <div>
                        <b>{t.name}</b>
                        <small>
                          {t.slug}
                          {t.ownerEmail ? ` · Owner: ${t.ownerEmail}` : ""}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`plan-chip ${t.planCode.toLowerCase()}`}>
                      {t.planCode}
                    </span>
                    <small className="cell-secondary">
                      {t.priceAmount
                        ? `${t.currency} ${t.priceAmount} / ${t.billingCycle.toLowerCase()}`
                        : "Price not set"}
                    </small>
                  </td>
                  <td>
                    <span className="member-count">
                      <Users size={14} />
                      {t.memberCount}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`tenant-status ${t.effectiveStatus.toLowerCase()}`}
                    >
                      <i />
                      {statusLabels[t.effectiveStatus]}
                    </span>
                  </td>
                  <td>
                    <span className="created-date">
                      <CalendarDays size={13} />
                      {t.currentPeriodEndsAt || t.trialEndsAt
                        ? new Date(
                          t.currentPeriodEndsAt || t.trialEndsAt!,
                        ).toLocaleDateString("en-IN")
                        : "—"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="access-btn manage"
                        onClick={() => void onOpenTenant(t)}
                      >
                        <History size={14} /> Manage
                      </button>
                      <button
                        className={`access-btn ${t.status === "SUSPENDED" ? "activate" : "suspend"}`}
                        disabled={
                          t.effectiveStatus === "EXPIRED" ||
                          t.effectiveStatus === "PAYMENT_PENDING"
                        }
                        onClick={() => void onChangeStatus(t)}
                        title={
                          t.status === "SUSPENDED"
                            ? "Reactivate only if subscription is valid"
                            : "Suspend tenant"
                        }
                      >
                        <Power size={14} />
                        {t.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="tenant-empty">
                  {view === "payments"
                    ? "No tenants currently require payment confirmation."
                    : "No workspaces match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="tenant-table-footer">
        <ShieldCheck size={15} />
        <span>
          Tenant access is evaluated by backend authorization and subscription
          rules. Platform controls do not replace tenant-level permissions.
        </span>
      </div>
    </section>
  );
}
