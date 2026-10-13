import type { TenantStatus } from "../types";

type Props = {
  status: TenantStatus;
  label: string;
};

export default function TenantStatusBadge({ status, label }: Props) {
  return (
    <span className={`tenant-status ${status.toLowerCase()}`}>
      <i />
      {label}
    </span>
  );
}
