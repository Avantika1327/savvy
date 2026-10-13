import { ArrowUpRight, CalendarDays, History, Mail, Power, Users } from "lucide-react";
import type { Tenant, TenantStatus } from "../types";
import PageSearchBar from "../components/PageSearchBar";
import TenantCard from "../components/TenantCard";

type Props = {
  loading: boolean;
  tenants: Tenant[];
  search: string;
  onSearchChange: (value: string) => void;
  statusLabels: Record<TenantStatus, string>;
  onOpenTenant: (tenant: Tenant) => void;
  onChangeStatus: (tenant: Tenant) => void;
};

export default function TenantWorkspacesPage({
  loading,
  tenants,
  search,
  onSearchChange,
  statusLabels,
  onOpenTenant,
  onChangeStatus,
}: Props) {
  return (
    <section className="platform-data-page">
      <PageSearchBar value={search} onChange={onSearchChange} resultCount={tenants.length} />

      {loading ? (
        <div className="page-state-card"><span className="page-state-spinner" />Loading tenant workspaces…</div>
      ) : tenants.length === 0 ? (
        <div className="page-state-card">
          <div className="page-state-icon"><Users size={23} /></div>
          <h3>{search ? "No matching workspaces" : "No customer workspaces yet"}</h3>
          <p>{search ? "Try another company name, owner email, workspace slug, or plan." : "Create a customer workspace to onboard the first business onto Savvy."}</p>
        </div>
      ) : (
        <div className="tenant-page-grid">
          {tenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              statusLabels={statusLabels}
              actions={
                <>
                  <button className="page-card-primary-action" onClick={() => onOpenTenant(tenant)}>
                    <History size={15} /> Manage workspace
                  </button>
                  <button
                    className="page-card-secondary-action"
                    disabled={tenant.effectiveStatus === "EXPIRED" || tenant.effectiveStatus === "PAYMENT_PENDING"}
                    onClick={() => onChangeStatus(tenant)}
                    title={tenant.status === "SUSPENDED" ? "Reactivate only if subscription is valid" : "Suspend tenant"}
                  >
                    <Power size={15} /> {tenant.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                  </button>
                  <ArrowUpRight size={15} className="page-card-action-mark" />
                </>
              }
            >
              <div className="tenant-card-facts">
                <div className="tenant-card-fact">
                  <span>Plan</span>
                  <strong><span className={`plan-chip ${tenant.planCode.toLowerCase()}`}>{tenant.planCode}</span></strong>
                </div>
                <div className="tenant-card-fact">
                  <span>Team members</span>
                  <strong><Users size={14} /> {tenant.memberCount}</strong>
                </div>
                <div className="tenant-card-fact">
                  <span>Configured price</span>
                  <strong>{tenant.priceAmount ? `${tenant.currency} ${tenant.priceAmount}` : "Not set"}</strong>
                  <small>{tenant.priceAmount ? `Billed ${tenant.billingCycle.toLowerCase()}` : "Add pricing in subscription settings"}</small>
                </div>
                <div className="tenant-card-fact">
                  <span>Valid until</span>
                  <strong><CalendarDays size={14} /> {tenant.currentPeriodEndsAt || tenant.trialEndsAt ? new Date(tenant.currentPeriodEndsAt || tenant.trialEndsAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not set"}</strong>
                </div>
              </div>
              {tenant.ownerEmail && <div className="tenant-card-contact"><Mail size={14} /><span>{tenant.ownerName || "Workspace owner"}</span><a href={`mailto:${tenant.ownerEmail}`}>{tenant.ownerEmail}</a></div>}
            </TenantCard>
          ))}
        </div>
      )}

      {!loading && tenants.length > 0 && (
        <div className="page-security-note">
          <Power size={15} /> Access changes are enforced by backend authorization and subscription rules.
        </div>
      )}
    </section>
  );
}
