import { useEffect } from "react";
import {
  ArchiveRestore,
  Building2,
  CalendarDays,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { Tenant, TenantStatus } from "../types";
import TenantStatusBadge from "../components/TenantStatusBadge";
import { formatDate } from "../formatters";

type Props = {
  tenants: Tenant[];
  loading: boolean;
  busyDeleting: boolean;
  statusLabels: Record<TenantStatus, string>;
  onLoad: () => Promise<void>;
  onRestore: (tenant: Tenant) => Promise<boolean>;
  onPermanentDelete: (tenant: Tenant) => Promise<boolean>;
};

export default function TenantTrashPage({
  tenants,
  loading,
  busyDeleting,
  statusLabels,
  onLoad,
  onRestore,
  onPermanentDelete,
}: Props) {
  useEffect(() => {
    void onLoad();
  }, [onLoad]);

  return (
    <section className="platform-data-page tenant-trash-page">
      <div className="tenant-trash-warning">
        <TriangleAlert size={18} />
        <div>
          <strong>Deleted workspaces</strong>
          <p>
            Restoring returns a workspace to the active workspace list.
            Permanent deletion cannot be undone and may be blocked by payment,
            audit, or other retained records.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="page-state-card">
          <span className="page-state-spinner" />
          Loading deleted workspaces…
        </div>
      ) : tenants.length === 0 ? (
        <div className="page-state-card">
          <div className="page-state-icon">
            <ArchiveRestore size={23} />
          </div>
          <h3>Trash is empty</h3>
          <p>Suspended workspaces moved to trash will appear here.</p>
        </div>
      ) : (
        <div className="tenant-page-grid">
          {tenants.map((tenant) => (
            <article className="tenant-page-card" key={tenant.id}>
              <div className="tenant-page-card-head">
                <div className="tenant-page-identity">
                  <div className="tenant-page-icon">
                    <Building2 size={20} />
                  </div>
                  <div className="tenant-page-name-wrap">
                    <span className="tenant-page-eyebrow">
                      DELETED WORKSPACE
                    </span>
                    <h3>{tenant.name}</h3>
                    <p>{tenant.slug}</p>
                  </div>
                </div>
                <TenantStatusBadge
                  status={tenant.effectiveStatus}
                  label={statusLabels[tenant.effectiveStatus]}
                />
              </div>
              <div className="tenant-page-card-body">
                <div className="tenant-card-facts">
                  <div className="tenant-card-fact">
                    <span>Owner email</span>
                    <strong>{tenant.ownerEmail || "—"}</strong>
                  </div>
                  <div className="tenant-card-fact">
                    <span>Deleted on</span>
                    <strong>
                      <CalendarDays size={14} />{" "}
                      {formatDate(tenant.deletedAt ?? null)}
                    </strong>
                  </div>
                  <div className="tenant-card-fact">
                    <span>Original workspace ID</span>
                    <strong>{tenant.id}</strong>
                  </div>
                </div>
              </div>
              <div className="tenant-page-card-actions">
                <button
                  type="button"
                  className="page-card-secondary-action"
                  disabled={busyDeleting}
                  onClick={() => void onRestore(tenant)}
                >
                  <RotateCcw size={15} /> Restore
                </button>
                <button
                  type="button"
                  className="page-card-danger-action"
                  disabled={busyDeleting}
                  onClick={() => void onPermanentDelete(tenant)}
                >
                  <Trash2 size={15} />{" "}
                  {busyDeleting ? "Processing…" : "Permanently delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
