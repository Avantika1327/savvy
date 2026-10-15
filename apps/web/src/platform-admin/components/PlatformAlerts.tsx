import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type Props = {
  error: string;
  notice: string;
  onDismissError: () => void;
  onDismissNotice: () => void;
};

export default function PlatformAlerts({
  error,
  notice,
  onDismissError,
  onDismissNotice,
}: Props) {
  return (
    <>
      {error && (
        <div className="platform-alert error">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => onDismissError()} aria-label="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div className="platform-alert success">
          <CheckCircle2 size={16} />
          {notice}
          <button
            onClick={() => onDismissNotice()}
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
