import { ChevronDown } from "lucide-react";
import { productionBars, productionDayLabels } from "../../data/dashboardData";

export default function OperationsChart() {
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div><h2>Operations overview</h2><p>Production output across the month</p></div>
        <button className="select-btn" type="button" disabled title="Period filtering is not connected yet">
          This month <ChevronDown size={14} />
        </button>
      </div>
      <div className="chart-legend">
        <span><i /> Actual production</span>
        <span className="chart-total">32,840 <small>units produced</small></span>
      </div>
      <div className="chart" role="img" aria-label="Sample production output bar chart for selected days of the month">
        <div className="y-labels"><span>10k</span><span>7.5k</span><span>5k</span><span>2.5k</span><span>0</span></div>
        <div className="bar-area">
          <div className="grid-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div className="bars">
            {productionBars.map((value, index) => (
              <div className="bar-wrap" key={productionDayLabels[index]}>
                <div className="bar" style={{ height: `${value}%` }} />
                <span>{productionDayLabels[index]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
