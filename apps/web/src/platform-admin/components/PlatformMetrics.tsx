
import type { PlatformMetric } from "../types";

type Props = { metrics: PlatformMetric[]; loading: boolean };

export default function PlatformMetrics({ metrics, loading }: Props) {
  return (
              <div className="platform-metrics">
                {metrics.map((m) => (
                  <div className="platform-metric" key={m.label}>
                    <div className={`stat-icon ${m.color}`}>
                      <m.icon size={18} />
                    </div>
                    <div className="platform-metric-copy">
                      <span>{m.label}</span>
                      <strong>{loading ? "—" : m.value}</strong>
                      <small>{m.hint}</small>
                    </div>
                  </div>
                ))}
              </div>
  );
}
