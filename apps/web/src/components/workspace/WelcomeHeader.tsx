import { CalendarDays, ChevronDown, Plus } from "lucide-react";
import type { WorkspacePage } from "../../types/dashboard";

type Props = {
  active: WorkspacePage;
  onCreateOrder: () => void;
};

export default function WelcomeHeader({ active, onCreateOrder }: Props) {
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="welcome-row">
      <div>
        <div className="eyebrow">
          <span className="live-dot" /> {today.toUpperCase()}
        </div>
        <h1>{active === "Dashboards" ? "Good morning, Admin 👋" : active}</h1>
        <p className="subhead">
          Dashboard preview — figures are sample data until operational APIs are
          connected.
        </p>
      </div>
      <div className="welcome-actions">
        <button
          className="secondary-btn"
          type="button"
          disabled
          title="Date filtering is not connected yet"
        >
          <CalendarDays size={16} /> Last 30 days <ChevronDown size={15} />
        </button>
        <button className="primary-btn" type="button" onClick={onCreateOrder}>
          <Plus size={17} /> Create order
        </button>
      </div>
    </div>
  );
}
