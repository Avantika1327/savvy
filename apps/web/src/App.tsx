import { useState } from "react";
import type { Session } from "./authTypes";
import Login from "./Login";
import PlatformTenants from "./PlatformTenants";
import {
  LayoutDashboard,
  Factory,
  Users,
  Truck,
  Package,
  ClipboardList,
  Wrench,
  Boxes,
  ChartNoAxesCombined,
  Search,
  Bell,
  ChevronDown,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Menu,
  Droplets,
  CalendarDays,
  CircleHelp,
} from "lucide-react";

const nav = [
  {
    section: "WORKSPACE",
    items: [
      ["Overview", LayoutDashboard],
      ["Orders", ClipboardList],
      ["Production", Factory],
      ["Raw stock", Boxes],
      ["Maintenance", Wrench],
    ],
  },
  {
    section: "MANAGEMENT",
    items: [
      ["Plants", Droplets],
      ["Customers", Users],
      ["Drivers", Truck],
      ["Vendors", Package],
      ["Reports", ChartNoAxesCombined],
    ],
  },
];
const stats = [
  {
    label: "Total orders",
    value: "1,284",
    change: "+12.8%",
    up: true,
    color: "violet",
    note: "vs. last month",
  },
  {
    label: "Production today",
    value: "8,420",
    change: "+6.4%",
    up: true,
    color: "mint",
    note: "vs. yesterday",
  },
  {
    label: "Low stock alerts",
    value: "12",
    change: "3 new",
    up: false,
    color: "amber",
    note: "needs attention",
  },
  {
    label: "Open maintenance",
    value: "07",
    change: "−2",
    up: true,
    color: "blue",
    note: "since last week",
  },
];
const orders = [
  [
    "#SV-2408",
    "Aarav Distributors",
    "Pune Plant",
    "2,400 jars",
    "In production",
  ],
  ["#SV-2407", "Green Valley Stores", "Akola Plant", "1,200 jars", "Pending"],
  [
    "#SV-2406",
    "FreshDrop Supply",
    "Amravati Plant",
    "3,600 jars",
    "Dispatched",
  ],
  ["#SV-2405", "Citywide Retail", "Pune Plant", "800 jars", "In production"],
  ["#SV-2404", "PureLife Partners", "Akola Plant", "1,500 jars", "Pending"],
];
const bars = [44, 62, 50, 76, 58, 87, 67, 94, 72, 60, 82, 70];
export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const value = sessionStorage.getItem("savvy-session");
      return value ? (JSON.parse(value) as Session) : null;
    } catch {
      return null;
    }
  });
  const logout = () => {
    const route =
      session?.user.platformRole === "SUPER_ADMIN"
        ? "/api/web/v1/platform-auth/logout"
        : "/api/web/v1/auth/logout";
    void fetch(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}${route}`,
      { method: "POST", credentials: "include" },
    ).finally(() => {
      sessionStorage.removeItem("savvy-session");
      setSession(null);
    });
  };
  if (!session)
    return (
      <Login
        onLogin={(value) => {
          sessionStorage.setItem("savvy-session", JSON.stringify(value));
          setSession(value);
        }}
      />
    );
  if (session.user.platformRole === "SUPER_ADMIN")
    return <PlatformTenants session={session} onLogout={logout} />;
  return (
    <TenantDashboard
      onLogout={logout}
      tenantName={session.tenant?.name ?? "Your workspace"}
    />
  );
}

function TenantDashboard({
  onLogout,
  tenantName,
}: {
  onLogout: () => void;
  tenantName: string;
}) {
  const [active, setActive] = useState("Overview");
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = orders.filter((o) =>
    o.join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="shell">
      <aside className={`sidebar ${mobile ? "show" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Droplets size={22} />
          </div>
          <div>
            <strong>
              savvy<span>.</span>
            </strong>
            <small>OPERATIONS PLATFORM</small>
          </div>
        </div>
        <div className="workspace">
          <div className="plant-icon">
            <Factory size={18} />
          </div>
          <div>
            <b>{tenantName}</b>
            <small>Tenant workspace</small>
          </div>
          <ChevronDown size={16} className="muted" />
        </div>
        {nav.map((group) => (
          <div className="nav-group" key={group.section}>
            <p>{group.section}</p>
            {group.items.map(([label, Icon]: any) => (
              <button
                key={label}
                onClick={() => {
                  setActive(label);
                  setMobile(false);
                }}
                className={`nav-item ${active === label ? "active" : ""}`}
              >
                <Icon size={18} />
                <span>{label}</span>
                {label === "Raw stock" && <i>3</i>}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="help">
            <CircleHelp size={19} />
            <div>
              <b>Need a hand?</b>
              <small>Visit the help centre</small>
            </div>
            <ArrowUpRight size={15} />
          </div>
          <div className="user">
            <div className="avatar">AD</div>
            <div>
              <b>Tenant account</b>
              <small>Workspace administrator</small>
            </div>
            <button className="logout-mini" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="crumb">
            Workspace <span>/</span> <b>{active}</b>
          </div>
          <div className="top-actions">
            <div className="search global-search">
              <Search size={17} />
              <input placeholder="Search anything..." />
            </div>
            <button className="icon-btn notification">
              <Bell size={19} />
              <i />
            </button>
            <div className="top-avatar">AD</div>
          </div>
        </header>
        <section className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="live-dot" /> TUESDAY, OCTOBER 13, 2026
              </div>
              <h1>
                {active === "Overview" ? "Good morning, Admin 👋" : active}
              </h1>
              <p className="subhead">
                Dashboard preview — live metrics will connect as the remaining
                Laravel workflows are migrated.
              </p>
            </div>
            <div className="welcome-actions">
              <button className="secondary-btn">
                <CalendarDays size={16} /> Last 30 days{" "}
                <ChevronDown size={15} />
              </button>
              <button
                className="primary-btn"
                onClick={() => setActive("Orders")}
              >
                <Plus size={17} /> Create order
              </button>
            </div>
          </div>
          <div className="stat-grid">
            {stats.map((s, i) => (
              <div className="stat-card" key={s.label}>
                <div className="stat-top">
                  <span>{s.label}</span>
                  <div className={`stat-icon ${s.color}`}>
                    {[<ClipboardList />, <Factory />, <Boxes />, <Wrench />][i]}
                  </div>
                </div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-foot">
                  <span className={s.up ? "positive" : "attention"}>
                    {s.up ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}{" "}
                    {s.change}
                  </span>
                  <span>{s.note}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="section-grid">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Operations overview</h2>
                  <p>Production output across the month</p>
                </div>
                <button className="select-btn">
                  This month <ChevronDown size={14} />
                </button>
              </div>
              <div className="chart-legend">
                <span>
                  <i /> Actual production
                </span>
                <span className="chart-total">
                  32,840 <small>units produced</small>
                </span>
              </div>
              <div className="chart">
                <div className="y-labels">
                  <span>10k</span>
                  <span>7.5k</span>
                  <span>5k</span>
                  <span>2.5k</span>
                  <span>0</span>
                </div>
                <div className="bar-area">
                  <div className="grid-lines">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="bars">
                    {bars.map((v, i) => (
                      <div className="bar-wrap" key={i}>
                        <div className="bar" style={{ height: `${v}%` }} />
                        <span>
                          {
                            [
                              "1",
                              "3",
                              "5",
                              "7",
                              "9",
                              "11",
                              "13",
                              "15",
                              "17",
                              "19",
                              "21",
                              "23",
                            ][i]
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            <section className="panel plant-panel">
              <div className="panel-heading">
                <div>
                  <h2>Plant performance</h2>
                  <p>Live operational status</p>
                </div>
                <button className="more-btn">•••</button>
              </div>
              <div className="plant-summary">
                <div className="ring">
                  <div>
                    <b>84%</b>
                    <small>Efficiency</small>
                  </div>
                </div>
                <div className="plant-key">
                  <div>
                    <i className="key-purple" />
                    Operational <b>3</b>
                  </div>
                  <div>
                    <i className="key-grey" />
                    Needs attention <b>1</b>
                  </div>
                  <div>
                    <i className="key-light" />
                    Offline <b>0</b>
                  </div>
                </div>
              </div>
              <div className="plant-list">
                {[
                  ["Pune Plant", "Running", "good"],
                  ["Akola Plant", "Running", "good"],
                  ["Amravati Plant", "Review stock", "warn"],
                ].map((p) => (
                  <div className="plant-row" key={p[0]}>
                    <div className="plant-mini">
                      <Factory size={17} />
                    </div>
                    <div>
                      <b>{p[0]}</b>
                      <small>Updated just now</small>
                    </div>
                    <span className={`status ${p[2]}`}>{p[1]}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="panel orders-panel">
            <div className="panel-heading orders-heading">
              <div>
                <h2>Recent orders</h2>
                <p>Keep track of the latest activity</p>
              </div>
              <button className="text-btn" onClick={() => setActive("Orders")}>
                View all orders <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="table-tools">
              <div className="search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search orders, customers..."
                />
              </div>
              <button className="secondary-btn compact">
                Filter <ChevronDown size={14} />
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ORDER ID</th>
                    <th>CUSTOMER</th>
                    <th>PLANT</th>
                    <th>QUANTITY</th>
                    <th>STATUS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o[0]}>
                      <td className="order-id">{o[0]}</td>
                      <td>
                        <b>{o[1]}</b>
                      </td>
                      <td>{o[2]}</td>
                      <td>{o[3]}</td>
                      <td>
                        <span
                          className={`pill ${o[4].toLowerCase().replaceAll(" ", "-")}`}
                        >
                          <i />
                          {o[4]}
                        </span>
                      </td>
                      <td>
                        <button className="row-more">•••</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="empty">No matching orders found.</div>
              )}
            </div>
          </section>
          <footer>
            © 2026 Savvy Operations{" "}
            <span>
              Built for smoother operations{" "}
              <span className="footer-heart">✦</span>
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}
