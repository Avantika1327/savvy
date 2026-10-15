import { CheckCircle2, CreditCard, History, Layers3, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Payment, Tenant, TenantForm, TenantStatus } from "../types";

type Props = {
  selected: Tenant | null;
  onClose: () => void;
  statusLabels: Record<TenantStatus, string>;
  error: string;
  subPlan: TenantForm["planCode"];
  setSubPlan: Dispatch<SetStateAction<TenantForm["planCode"]>>;
  subCycle: TenantForm["billingCycle"];
  setSubCycle: Dispatch<SetStateAction<TenantForm["billingCycle"]>>;
  subPrice: string;
  setSubPrice: Dispatch<SetStateAction<string>>;
  busyPayment: boolean;
  onUpdateSubscription: (event: FormEvent<HTMLFormElement>) => void;
  paymentAmount: string;
  setPaymentAmount: Dispatch<SetStateAction<string>>;
  paymentReference: string;
  setPaymentReference: Dispatch<SetStateAction<string>>;
  paymentNotes: string;
  setPaymentNotes: Dispatch<SetStateAction<string>>;
  onRecordPayment: (event: FormEvent<HTMLFormElement>) => void;
  payments: Payment[];
  verificationNote: string;
  setVerificationNote: Dispatch<SetStateAction<string>>;
  onConfirmPayment: (payment: Payment) => void;
};

export default function ManageTenantModal({
  selected,
  onClose,
  statusLabels,
  error,
  subPlan,
  setSubPlan,
  subCycle,
  setSubCycle,
  subPrice,
  setSubPrice,
  busyPayment,
  onUpdateSubscription,
  paymentAmount,
  setPaymentAmount,
  paymentReference,
  setPaymentReference,
  paymentNotes,
  setPaymentNotes,
  onRecordPayment,
  payments,
  verificationNote,
  setVerificationNote,
  onConfirmPayment,
}: Props) {
  if (!selected) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="manage-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-title"
      >
        <div className="modal-heading">
          <div>
            <div className="eyebrow">TENANT MANAGEMENT</div>
            <h2 id="manage-title">{selected.name}</h2>
            <p>
              Tenant ID: {selected.id} · {selected.slug} ·{" "}
              {statusLabels[selected.effectiveStatus]} · created{" "}
              {new Date(selected.createdAt).toLocaleDateString()}
              <br />
              Owner: {selected.ownerName ?? "—"} ({selected.ownerEmail ?? "—"})
              · Contact: {selected.contactName ?? "—"} ·{" "}
              {selected.contactEmail ?? "—"} · {selected.contactPhone ?? "—"}
            </p>
          </div>
          <button className="modal-close" onClick={() => onClose()}>
            <X size={18} />
          </button>
        </div>
        {error && <div className="platform-alert error">{error}</div>}
        <form className="subscription-form" onSubmit={onUpdateSubscription}>
          <h3>
            <Layers3 size={16} /> Subscription settings
          </h3>
          <div className="form-grid">
            <label>
              Plan
              <select
                value={subPlan}
                onChange={(e) => setSubPlan(e.target.value as typeof subPlan)}
              >
                <option value="STARTER">Starter</option>
                <option value="GROWTH">Growth</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </label>
            <label>
              Cycle
              <select
                value={subCycle}
                onChange={(e) => setSubCycle(e.target.value as typeof subCycle)}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </label>
            <label>
              Price (INR)
              <input
                required
                min="0"
                type="number"
                step="0.01"
                value={subPrice}
                onChange={(e) => setSubPrice(e.target.value)}
              />
            </label>
          </div>
          <button
            className="secondary-btn"
            disabled={busyPayment}
            type="submit"
          >
            Save subscription settings
          </button>
          <small>
            Changing plan or price does not itself activate or renew access.
          </small>
        </form>
        <form className="subscription-form" onSubmit={onRecordPayment}>
          <h3>
            <CreditCard size={16} /> Record a payment
          </h3>
          <div className="form-grid">
            <label>
              Amount (INR)
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </label>
            <label>
              Bank / UPI / receipt reference
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction ID (optional)"
              />
            </label>
            <label>
              Notes
              <input
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Receipt or verification context"
              />
            </label>
          </div>
          <button className="primary-btn" disabled={busyPayment} type="submit">
            Record as pending
          </button>
        </form>
        <section className="payment-history">
          <h3>
            <History size={16} /> Payment history
          </h3>
          {payments.length === 0 ? (
            <p className="no-payments">
              No payments have been recorded for this tenant.
            </p>
          ) : (
            payments.map((p) => (
              <div className="payment-row" key={p.id}>
                <div>
                  <b>
                    {p.currency} {p.amount}
                  </b>
                  <small>
                    {p.method} · {new Date(p.createdAt).toLocaleString()}
                    {p.reference ? ` · Ref: ${p.reference}` : ""}
                  </small>
                  <small>
                    Recorded by {p.createdBy.name}
                    {p.confirmedBy
                      ? ` · Confirmed by ${p.confirmedBy.name}`
                      : ""}
                  </small>
                  {p.notes && <small>{p.notes}</small>}
                </div>
                <div className="payment-actions">
                  <span className={`payment-pill ${p.status.toLowerCase()}`}>
                    {p.status}
                  </span>
                  {p.status === "PENDING" && (
                    <button
                      className="access-btn activate"
                      disabled={busyPayment}
                      onClick={() => void onConfirmPayment(p)}
                    >
                      <CheckCircle2 size={14} /> Confirm
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {payments.some((p) => p.status === "PENDING") && (
            <label className="verify-note">
              Payment verification note
              <input
                required
                minLength={3}
                maxLength={1000}
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                placeholder="e.g. Checked bank statement / UPI reference"
              />
              <small>Only confirm after independently verifying receipt.</small>
            </label>
          )}
        </section>
      </section>
    </div>
  );
}
