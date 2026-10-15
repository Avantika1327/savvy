import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { DashboardStat } from "../../types/dashboard";

type Props = { stat: DashboardStat };

export default function DashboardStatCard({ stat }: Props) {
  const Icon = stat.icon;
  const ChangeIcon = stat.up ? ArrowUpRight : ArrowDownRight;
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{stat.label}</span>
        <div className={`stat-icon ${stat.color}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-value">{stat.value}</div>
      <div className="stat-foot">
        <span className={stat.up ? "positive" : "attention"}>
          <ChangeIcon size={14} /> {stat.change}
        </span>
        <span>{stat.note}</span>
      </div>
    </article>
  );
}
