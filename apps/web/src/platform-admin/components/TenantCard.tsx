import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import type { Tenant, TenantStatus } from "../types";
import TenantStatusBadge from "./TenantStatusBadge";

type Props = {
  tenant: Tenant;
  statusLabels: Record<TenantStatus, string>;
  eyebrow?: string;
  children?: ReactNode;
  actions?: ReactNode;
};

export default function TenantCard({
  tenant,
  statusLabels,
  eyebrow = "CUSTOMER WORKSPACE",
  children,
  actions,
}: Props) {
  return (
    <article className="tenant-page-card">
      <div className="tenant-page-card-head">
        <div className="tenant-page-identity">
          <div className="tenant-page-icon"><Building2 size={20} /></div>
          <div className="tenant-page-name-wrap">
            <span className="tenant-page-eyebrow">{eyebrow}</span>
            <h3>{tenant.name}</h3>
            <p>{tenant.slug}</p>
          </div>
        </div>
        <TenantStatusBadge status={tenant.effectiveStatus} label={statusLabels[tenant.effectiveStatus]} />
      </div>

      <div className="tenant-page-card-body">
        {children}
      </div>

      {actions && <div className="tenant-page-card-actions">{actions}</div>}
    </article>
  );
}
