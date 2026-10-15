import { ArrowUpRight, ChevronDown, Search } from "lucide-react";
import type { DashboardOrder, WorkspacePage } from "../../types/dashboard";

type Props = {
  orders: DashboardOrder[];
  search: string;
  onSearchChange: (value: string) => void;
  onViewAll: (page: WorkspacePage) => void;
};

export default function RecentOrdersCard({ orders, search, onSearchChange, onViewAll }: Props) {
  return (
    <section className="panel orders-panel">
      <div className="panel-heading orders-heading">
        <div><h2>Recent orders</h2><p>Sample order activity</p></div>
        <button className="text-btn" type="button" onClick={() => onViewAll("Orders")}>
          View all orders <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="table-tools">
        <label className="search">
          <Search size={16} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search orders, customers…" aria-label="Search orders and customers" />
        </label>
        <button className="secondary-btn compact" type="button" disabled title="Order filtering is not connected yet">
          Filter <ChevronDown size={14} />
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>ORDER ID</th><th>CUSTOMER</th><th>PLANT</th><th>QUANTITY</th><th>STATUS</th><th /></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="order-id">{order.id}</td>
                <td><b>{order.customer}</b></td>
                <td>{order.plant}</td>
                <td>{order.quantity}</td>
                <td><span className={`pill ${order.status.toLowerCase().replaceAll(" ", "-")}`}><i />{order.status}</span></td>
                <td><button className="row-more" type="button" disabled aria-label={`More actions for ${order.id}`}>•••</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <div className="empty">No matching orders found.</div>}
      </div>
    </section>
  );
}
