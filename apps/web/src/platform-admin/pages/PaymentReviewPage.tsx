import { CircleAlert, CreditCard, Mail, WalletCards } from "lucide-react";
import type { Tenant, TenantStatus } from "../types";
import PageSearchBar from "../components/PageSearchBar";
import TenantCard from "../components/TenantCard";
import { formatBillingCycle, formatCurrency } from "../formatters";

type Props = {
  loading: boolean;
  tenants: Tenant[];
  search: string;
  onSearchChange: (value: string) => void;
  statusLabels: Record<TenantStatus, string>;
  onReviewPayment: (tenant: Tenant) => void;
};

export default function PaymentReviewPage({ loading, tenants, search, onSearchChange, statusLabels, onReviewPayment }: Props) {
  return (
    <section className="platform-data-page">
      <div className="payment-review-banner">
        <span className="payment-review-banner-icon"><CircleAlert size={20} /></span>
        <div><strong>{loading ? "—" : tenants.length} payment {tenants.length === 1 ? "requires" : "require"} review</strong><p>Open each customer to inspect payment history. Confirm a payment only after verifying the receipt or transaction reference.</p></div>
        <WalletCards size={22} className="payment-review-banner-art" />
      </div>
      <PageSearchBar value={search} onChange={onSearchChange} resultCount={tenants.length} placeholder="Search payment-pending customers…" />
      {loading ? (
        <div className="page-state-card"><span className="page-state-spinner" />Loading payment review queue…</div>
      ) : tenants.length === 0 ? (
        <div className="page-state-card"><div className="page-state-icon"><CreditCard size={23} /></div><h3>You're all caught up</h3><p>{search ? "No payment-pending customers match your search." : "There are no customers waiting for payment confirmation right now."}</p></div>
      ) : (
        <div className="tenant-page-grid">
          {tenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              statusLabels={statusLabels}
              eyebrow="PAYMENT REVIEW REQUIRED"
              actions={<button className="page-card-primary-action" onClick={() => onReviewPayment(tenant)}><CreditCard size={15} /> Review payment history</button>}
            >
              <div className="payment-review-amount"><span>Configured subscription amount</span><strong>{formatCurrency(tenant.priceAmount, tenant.currency)}<small>{formatBillingCycle(tenant.billingCycle)} billing · {tenant.planCode}</small></strong></div>
              {tenant.ownerEmail && <div className="tenant-card-contact"><Mail size={14} /><a href={`mailto:${tenant.ownerEmail}`}>{tenant.ownerEmail}</a></div>}
              <p className="payment-review-note">Review the customer's payment history before granting paid access.</p>
            </TenantCard>
          ))}
        </div>
      )}
    </section>
  );
}
