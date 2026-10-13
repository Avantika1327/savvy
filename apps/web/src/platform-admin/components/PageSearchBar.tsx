import { Search, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount: number;
  resultLabel?: string;
};

export default function PageSearchBar({
  value,
  onChange,
  placeholder = "Search customers, workspace or plan…",
  resultCount,
  resultLabel = "workspaces",
}: Props) {
  return (
    <div className="page-search-toolbar">
      <label className="page-search-box">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {value && (
          <button type="button" onClick={() => onChange("")} aria-label="Clear search">
            <X size={15} />
          </button>
        )}
      </label>
      <span className="page-result-count">
        {resultCount} {resultCount === 1 ? resultLabel.replace(/s$/, "") : resultLabel}
      </span>
    </div>
  );
}
