import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  CreditCard,
  Edit3,
  Mail,
  Phone,
  Power,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { Tenant, TenantStatus } from "../types";
import TenantStatusBadge from "../components/TenantStatusBadge";
import { formatBillingCycle, formatCurrency, formatDate } from "../formatters";

type EditableTenantFields = {
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type Props = {
  tenants: Tenant[];
  loading: boolean;
  statusLabels: Record<TenantStatus, string>;
  saving: boolean;
  deleting: boolean;
  onBack: () => void;
  onSave: (tenantId: string, values: EditableTenantFields) => Promise<boolean>;
  onManageSubscription: (tenant: Tenant) => void;
  onChangeStatus: (tenant: Tenant) => void;
  onSoftDelete: (tenant: Tenant) => Promise<boolean>;
};

function initialValues(tenant: Tenant): EditableTenantFields {
  return {
    name: tenant.name,
    slug: tenant.slug,
    contactName: tenant.contactName ?? "",
    contactEmail: tenant.contactEmail ?? "",
    contactPhone: tenant.contactPhone ?? "",
  };
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="tenant-detail-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default function TenantDetailPage({
  tenants,
  loading,
  statusLabels,
  saving,
  deleting,
  onBack,
  onSave,
  onManageSubscription,
  onChangeStatus,
  onSoftDelete,
}: Props) {
  const { tenantId } = useParams<{ tenantId: string }>();
  const tenant = tenants.find((item) => item.id === tenantId) ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableTenantFields | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (tenant) {
      setDraft(initialValues(tenant));
      setEditing(false);
      setFormError("");
    }
  }, [tenant?.id]); // A change to the selected tenant resets the edit form.

  if (loading && !tenant) {
    return (
      <div className="page-state-card">
        <span className="page-state-spinner" />
        Loading tenant details…
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="page-state-card">
        <div className="page-state-icon">
          <Building2 size={23} />
        </div>
        <h3>Workspace not found</h3>
        <p>
          This workspace may have been removed, or you may not have access to
          it.
        </p>
        <button
          type="button"
          className="page-card-primary-action"
          onClick={onBack}
        >
          <ArrowLeft size={15} /> Back to workspaces
        </button>
      </div>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    const slug = draft.slug.trim().toLowerCase();
    if (!name) {
      setFormError("Business name is required.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setFormError(
        "Workspace slug must use lowercase letters, numbers, and single hyphens between words.",
      );
      return;
    }
    if (
      draft.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail.trim())
    ) {
      setFormError("Enter a valid contact email address.");
      return;
    }

    setFormError("");
    const saved = await onSave(tenant.id, {
      ...draft,
      name,
      slug,
      contactName: draft.contactName.trim(),
      contactEmail: draft.contactEmail.trim(),
      contactPhone: draft.contactPhone.trim(),
    });
    if (saved) setEditing(false);
  };

  const suspended = tenant.status === "SUSPENDED";

  return (
    <section className="platform-data-page tenant-detail-page">
      <div className="tenant-detail-toolbar">
        <button type="button" className="tenant-detail-back" onClick={onBack}>
          <ArrowLeft size={16} /> All workspaces
        </button>
        <span className="tenant-detail-id">Workspace ID: {tenant.id}</span>
      </div>

      <section className="tenant-detail-hero">
        <div className="tenant-detail-identity">
          <div className="tenant-detail-logo">
            <Building2 size={26} />
          </div>
          <div>
            <span className="tenant-page-eyebrow">CUSTOMER WORKSPACE</span>
            <h1>{tenant.name}</h1>
            <p>{tenant.slug}</p>
            <TenantStatusBadge
              status={tenant.effectiveStatus}
              label={statusLabels[tenant.effectiveStatus]}
            />
          </div>
        </div>
        <div className="tenant-detail-primary-actions">
          {!editing && (
            <button
              type="button"
              className="page-card-primary-action"
              onClick={() => {
                setDraft(initialValues(tenant));
                setEditing(true);
              }}
            >
              <Edit3 size={15} /> Edit details
            </button>
          )}
          <button
            type="button"
            className="page-card-secondary-action"
            onClick={() => onManageSubscription(tenant)}
          >
            <CreditCard size={15} /> Manage subscription
          </button>
          <button
            type="button"
            className="page-card-secondary-action"
            onClick={() => onChangeStatus(tenant)}
            disabled={
              tenant.effectiveStatus === "EXPIRED" ||
              tenant.effectiveStatus === "PAYMENT_PENDING"
            }
            title={
              suspended
                ? "Reactivate only if the subscription is valid"
                : "Suspend this workspace before deleting it"
            }
          >
            <Power size={15} /> {suspended ? "Reactivate" : "Suspend"}
          </button>
          <button
            type="button"
            className="page-card-danger-action"
            onClick={async () => {
              if (suspended) {
                const done = await onSoftDelete(tenant);
                if (done) onBack();
              }
            }}
            disabled={!suspended || deleting}
            title={
              !suspended
                ? "Suspend the workspace before moving it to trash"
                : "Move this workspace to trash"
            }
          >
            <Trash2 size={15} /> {deleting ? "Moving…" : "Move to trash"}
          </button>
        </div>
      </section>

      {!suspended && (
        <div className="tenant-delete-policy-note">
          <ShieldCheck size={15} /> Suspend this workspace before moving it to
          trash. Suspended workspaces lose access through backend authorization.
        </div>
      )}

      {editing && draft && (
        <form
          className="tenant-detail-panel tenant-edit-panel"
          onSubmit={submit}
        >
          <div className="tenant-detail-panel-heading">
            <div>
              <h2>Edit workspace details</h2>
              <p>
                Update the business and contact information. Owner login
                credentials are managed separately.
              </p>
            </div>
            <button
              type="button"
              className="tenant-detail-icon-button"
              onClick={() => {
                setEditing(false);
                setDraft(initialValues(tenant));
                setFormError("");
              }}
              aria-label="Cancel editing"
            >
              <X size={17} />
            </button>
          </div>
          <div className="tenant-edit-grid">
            <label>
              Business name
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              Workspace slug
              <input
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={draft.slug}
                onChange={(event) =>
                  setDraft({ ...draft, slug: event.target.value.toLowerCase() })
                }
              />
              <small>Lowercase letters, numbers and hyphens only.</small>
            </label>
            <label>
              Contact person
              <input
                maxLength={120}
                value={draft.contactName}
                onChange={(event) =>
                  setDraft({ ...draft, contactName: event.target.value })
                }
              />
            </label>
            <label>
              Contact email
              <input
                type="email"
                maxLength={254}
                value={draft.contactEmail}
                onChange={(event) =>
                  setDraft({ ...draft, contactEmail: event.target.value })
                }
              />
            </label>
            <label>
              Contact phone
              <input
                maxLength={40}
                value={draft.contactPhone}
                onChange={(event) =>
                  setDraft({ ...draft, contactPhone: event.target.value })
                }
              />
            </label>
          </div>
          {formError && (
            <div className="tenant-form-error" role="alert">
              {formError}
            </div>
          )}
          <div className="tenant-detail-form-actions">
            <button
              type="button"
              className="page-card-secondary-action"
              onClick={() => {
                setEditing(false);
                setDraft(initialValues(tenant));
                setFormError("");
              }}
            >
              <X size={15} /> Cancel
            </button>
            <button
              type="submit"
              className="page-card-primary-action"
              disabled={saving}
            >
              <Save size={15} /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      <div className="tenant-detail-grid">
        <section className="tenant-detail-panel">
          <div className="tenant-detail-panel-heading">
            <div>
              <h2>Business information</h2>
              <p>Workspace identity and primary contact.</p>
            </div>
            <Building2 size={18} />
          </div>
          <div className="tenant-detail-items">
            <DetailItem label="Business name" value={tenant.name} />
            <DetailItem label="Workspace slug" value={tenant.slug} />
            <DetailItem
              label="Contact person"
              value={tenant.contactName ?? ""}
            />
            <DetailItem
              label="Contact email"
              value={tenant.contactEmail ?? ""}
            />
            <DetailItem
              label="Contact phone"
              value={tenant.contactPhone ?? ""}
            />
          </div>
        </section>

        <section className="tenant-detail-panel">
          <div className="tenant-detail-panel-heading">
            <div>
              <h2>Workspace owner</h2>
              <p>Owner account and team access.</p>
            </div>
            <UserRound size={18} />
          </div>
          <div className="tenant-detail-items">
            <DetailItem
              label="Owner name"
              value={tenant.ownerName ?? "Not available"}
            />
            <DetailItem
              label="Owner login email"
              value={tenant.ownerEmail ?? "Not available"}
            />
            <DetailItem
              label="Team members"
              value={String(tenant.memberCount)}
            />
          </div>
          {tenant.ownerEmail && (
            <a
              className="tenant-detail-inline-link"
              href={`mailto:${tenant.ownerEmail}`}
            >
              <Mail size={14} /> Email owner
            </a>
          )}
        </section>

        <section className="tenant-detail-panel">
          <div className="tenant-detail-panel-heading">
            <div>
              <h2>Subscription</h2>
              <p>Plan, billing and current validity.</p>
            </div>
            <CreditCard size={18} />
          </div>
          <div className="tenant-detail-items">
            <DetailItem label="Plan" value={tenant.planCode} />
            <DetailItem
              label="Subscription status"
              value={
                tenant.subscriptionStatus ||
                statusLabels[tenant.effectiveStatus]
              }
            />
            <DetailItem
              label="Configured price"
              value={formatCurrency(tenant.priceAmount, tenant.currency)}
            />
            <DetailItem
              label="Billing cycle"
              value={formatBillingCycle(tenant.billingCycle)}
            />
            <DetailItem
              label="Period starts"
              value={formatDate(tenant.currentPeriodStartsAt ?? null)}
            />
            <DetailItem
              label="Period ends"
              value={formatDate(tenant.currentPeriodEndsAt)}
            />
            <DetailItem
              label="Trial expires"
              value={formatDate(tenant.trialEndsAt)}
            />
          </div>
          <button
            type="button"
            className="tenant-detail-text-action"
            onClick={() => onManageSubscription(tenant)}
          >
            Manage plan and payment history <CreditCard size={14} />
          </button>
        </section>

        <section className="tenant-detail-panel">
          <div className="tenant-detail-panel-heading">
            <div>
              <h2>Workspace lifecycle</h2>
              <p>Creation and access status history.</p>
            </div>
            <Clock3 size={18} />
          </div>
          <div className="tenant-detail-items">
            <DetailItem
              label="Created on"
              value={formatDate(tenant.createdAt)}
            />
            <DetailItem
              label="Activated on"
              value={formatDate(tenant.activatedAt)}
            />
            <DetailItem
              label="Deactivated on"
              value={formatDate(tenant.deactivatedAt)}
            />
            <DetailItem
              label="Current access state"
              value={statusLabels[tenant.effectiveStatus]}
            />
          </div>
          <div className="tenant-lifecycle-note">
            <CalendarDays size={15} /> Status transitions and subscription
            validity must be validated by the API before access changes are
            applied.
          </div>
        </section>
      </div>
      <div className="tenant-detail-footer">
        <Phone size={14} /> Owner login details are not editable from this
        screen. Use your approved account-management workflow for credential
        changes.
      </div>
    </section>
  );
}
