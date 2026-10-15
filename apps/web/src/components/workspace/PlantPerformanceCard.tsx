import { Factory } from "lucide-react";
import { plantStatuses } from "../../data/dashboardData";

export default function PlantPerformanceCard() {
  return (
    <section className="panel plant-panel">
      <div className="panel-heading">
        <div><h2>Plant performance</h2><p>Sample operational status</p></div>
        <button className="more-btn" type="button" disabled aria-label="More plant performance actions">•••</button>
      </div>
      <div className="plant-summary">
        <div className="ring"><div><b>84%</b><small>Efficiency</small></div></div>
        <div className="plant-key">
          <div><i className="key-purple" /> Operational <b>3</b></div>
          <div><i className="key-grey" /> Needs attention <b>1</b></div>
          <div><i className="key-light" /> Offline <b>0</b></div>
        </div>
      </div>
      <div className="plant-list">
        {plantStatuses.map((plant) => (
          <div className="plant-row" key={plant.name}>
            <div className="plant-mini"><Factory size={17} /></div>
            <div><b>{plant.name}</b><small>Demo status · not live</small></div>
            <span className={`status ${plant.tone}`}>{plant.state}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
