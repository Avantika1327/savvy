import { ArrowUpRight, CalendarDays, CreditCard, Eye, History,Trash2, Mail, Power, Users } from "lucide-react";
import type { Tenant, TenantStatus } from "../types";
import PageSearchBar from "../components/PageSearchBar";
import TenantCard from "../components/TenantCard";
import { formatBillingCycle, formatCurrency, formatDate } from "../formatters";

type Props = {
  loading: boolean;
  tenants: Tenant[];
  search: string;
  onSearchChange: (value: string) => void;
  statusLabels: Record<TenantStatus, string>;
  onOpenTenant: (tenant: Tenant) => void;
  onViewDetails: (tenant: Tenant) => void;
  onOpenTrash: () => void;
  onChangeStatus: (tenant: Tenant) => void;
};

export default function TenantWorkspacesPage({
  loading,
  tenants,
  search,
  onSearchChange,
  statusLabels,
  onOpenTenant,
  onViewDetails,
  onOpenTrash,
  onChangeStatus,
}: Props) {
  return (
    <section className="platform-data-page">
      <div className="tenant-list-toolbar">
        <PageSearchBar value={search} onChange={onSearchChange} resultCount={tenants.length} />
        <button type="button" className="page-card-secondary-action" onClick={onOpenTrash}><Trash2 size={15} /> View trash</button>
      </div>

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
                  <button className="page-card-primary-action" onClick={() => onViewDetails(tenant)}>
                    <Eye size={15} /> View details
                  </button>
                  <button className="page-card-secondary-action" onClick={() => onOpenTenant(tenant)}>
                    <CreditCard size={15} /> Manage billing
                  </button>
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
                  <strong>{formatCurrency(tenant.priceAmount, tenant.currency)}</strong>
                  <small>{tenant.priceAmount !== null ? `Billed ${formatBillingCycle(tenant.billingCycle).toLowerCase()}` : "Add pricing in subscription settings"}</small>
                </div>
                <div className="tenant-card-fact">
                  <span>Valid until</span>
                  <strong><CalendarDays size={14} /> {formatDate(tenant.currentPeriodEndsAt || tenant.trialEndsAt)}</strong>
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
