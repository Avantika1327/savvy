import { Bell, Menu, Search } from "lucide-react";
import type { WorkspacePage } from "../../types/dashboard";

type Props = {
  active: WorkspacePage;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onToggleMobile: () => void;
  showSearch?: boolean;
};

export default function WorkspaceTopbar({
  active,
  searchValue,
  onSearchChange,
  onToggleMobile,
  showSearch = true,
}: Props) {
  return (
    <header className="topbar">
      <button
        className="icon-btn mobile-menu"
        type="button"
        onClick={onToggleMobile}
        aria-label="Toggle navigation menu"
      >
        <Menu />
      </button>
      <div className="crumb">
        Workspace <span>/</span> <b>{active}</b>
      </div>
      <div className="top-actions">
        {showSearch && (
          <label className="search global-search">
            <Search size={17} />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search recent orders…"
              aria-label="Search recent orders"
            />
          </label>
        )}
        <button
          className="icon-btn notification"
          type="button"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={19} />
          <i />
        </button>
        <div className="top-avatar" aria-hidden="true">
          SW
        </div>
      </div>
    </header>
  );
}
