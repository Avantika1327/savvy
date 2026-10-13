import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Search,
  Plus,
  ShieldCheck,
  Users,
  CircleCheck,
  Power,
  RefreshCw,
  LogOut,
  X,
  CalendarDays,
  Layers3,
  CreditCard,
  History,
  CheckCircle2,
  AlertTriangle,
  LayoutDashboard,
  Banknote,
  Clock3,
  ArrowUpRight,
  ChevronRight,
  WalletCards,
  Activity,
  TrendingUp,
} from "lucide-react";
import type { Session } from "./authTypes";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
type TenantStatus =
  "TRIAL" | "ACTIVE" | "INACTIVE" | "PAYMENT_PENDING" | "SUSPENDED" | "EXPIRED";
type Tenant = {
  id: string;
  name: string;
  slug: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  status: TenantStatus;
  effectiveStatus: TenantStatus;
  planCode: string;
  subscriptionStatus: string;
  billingCycle: string;
  priceAmount: string | null;
  currency: string;
  createdAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  memberCount: number;
};
type Payment = {
  id: string;
  amount: string;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED";
  method: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  confirmedAt: string | null;
  createdBy: { name: string; email: string };
  confirmedBy: { name: string; email: string } | null;
};
type TenantForm = {
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planCode: "STARTER" | "GROWTH" | "ENTERPRISE";
  priceAmount: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  trialDays: number;
};
const emptyForm: TenantForm = {
  name: "",
  slug: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  planCode: "STARTER",
  priceAmount: "",
  billingCycle: "MONTHLY",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  trialDays: 14,
};
const statusLabels: Record<TenantStatus, string> = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PAYMENT_PENDING: "Payment pending",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
};
export default function PlatformTenants({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<
    "overview" | "tenants" | "subscriptions" | "payments"
  >("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<TenantForm>(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [busyPayment, setBusyPayment] = useState(false);
  const [subPrice, setSubPrice] = useState("");
  const [subPlan, setSubPlan] = useState<"STARTER" | "GROWTH" | "ENTERPRISE">(
    "STARTER",
  );
  const [subCycle, setSubCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${API}/api/web/v1${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      credentials: "include",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error?.message ?? "Request failed.");
    return data;
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request("/platform/tenants");
      setTenants(result.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load tenants.");
    } finally {
      setLoading(false);
    }
  }, [request]);
  const loadPayments = useCallback(
    async (t: Tenant) => {
      setSelected(t);
      setPaymentAmount(t.priceAmount ?? "");
      setSubPrice(t.priceAmount ?? "");
      setSubPlan(t.planCode as TenantForm["planCode"]);
      setSubCycle(t.billingCycle as TenantForm["billingCycle"]);
      setError("");
      try {
        const result = await request(`/platform/tenants/${t.id}/payments`);
        setPayments(result.data ?? []);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to load payment history.",
        );
        setPayments([]);
      }
    },
    [request],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const searchMatches = (t: Tenant) =>
    `${t.name} ${t.slug} ${t.planCode} ${statusLabels[t.effectiveStatus]} ${t.ownerEmail ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
  const filtered = tenants.filter(
    (t) =>
      searchMatches(t) &&
      (view !== "payments" || t.effectiveStatus === "PAYMENT_PENDING"),
  );
  const activeCount = tenants.filter(
    (t) => t.effectiveStatus === "ACTIVE",
  ).length;
  const trialCount = tenants.filter(
    (t) => t.effectiveStatus === "TRIAL",
  ).length;
  const pendingCount = tenants.filter(
    (t) => t.effectiveStatus === "PAYMENT_PENDING",
  ).length;
  const restrictedCount = tenants.filter((t) =>
    ["SUSPENDED", "EXPIRED", "INACTIVE"].includes(t.effectiveStatus),
  ).length;
  const monthlyValue = tenants
    .filter((t) => t.effectiveStatus === "ACTIVE" && t.priceAmount)
    .reduce(
      (sum, t) =>
        sum +
        (Number(t.priceAmount) || 0) / (t.billingCycle === "ANNUAL" ? 12 : 1),
      0,
    );
  const money = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  const metrics = [
    {
      label: "Total workspaces",
      value: String(tenants.length),
      hint: "Customer businesses",
      icon: Building2,
      color: "violet",
    },
    {
      label: "Active subscriptions",
      value: String(activeCount),
      hint: "Access currently enabled",
      icon: CircleCheck,
      color: "mint",
    },
    {
      label: "Trial accounts",
      value: String(trialCount),
      hint: "Time-limited access",
      icon: Clock3,
      color: "blue",
    },
    {
      label: "Estimated MRR",
      value: money(monthlyValue),
      hint: "Configured active pricing",
      icon: Banknote,
      color: "violet",
    },
    {
      label: "Payment review",
      value: String(pendingCount),
      hint: "Awaiting verification",
      icon: CreditCard,
      color: "amber",
    },
  ];
  const planBreakdown = ["STARTER", "GROWTH", "ENTERPRISE"].map((plan) => ({
    plan,
    count: tenants.filter((t) => t.planCode.toUpperCase() === plan).length,
  }));
  const recentTenants = [...tenants]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);
  const attentionRank: Record<TenantStatus, number> = {
    PAYMENT_PENDING: 0,
    SUSPENDED: 1,
    EXPIRED: 2,
    INACTIVE: 3,
    ACTIVE: 4,
    TRIAL: 5,
  };
  const attentionTenants = [...tenants]
    .filter((t) =>
      ["PAYMENT_PENDING", "SUSPENDED", "EXPIRED", "INACTIVE"].includes(
        t.effectiveStatus,
      ),
    )
    .sort(
      (a, b) =>
        attentionRank[a.effectiveStatus] - attentionRank[b.effectiveStatus],
    )
    .slice(0, 4);
  const viewTitles = {
    overview: "Platform overview",
    tenants: "Tenant workspaces",
    subscriptions: "Subscriptions & plans",
    payments: "Payment review queue",
  };
  const viewDescriptions = {
    overview: "Your SaaS business at a glance.",
    tenants: "Manage customer workspaces and access.",
    subscriptions: "Review plans, billing cycles and subscription validity.",
    payments: "Follow up on tenants that still require payment confirmation.",
  };
  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        ...form,
        contactName: form.contactName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        priceAmount:
          form.priceAmount === "" ? undefined : Number(form.priceAmount),
      };
      await request("/platform/tenants", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setShowCreate(false);
      setForm(emptyForm);
      setNotice(
        "Tenant created. Trial access is time-limited; customers without a trial remain payment-pending until a payment is explicitly verified.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create tenant.");
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus(t: Tenant) {
    const next: TenantStatus =
      t.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    if (
      next === "SUSPENDED" &&
      !window.confirm(
        `Suspend ${t.name}? Tenant API access will be blocked immediately.`,
      )
    )
      return;
    setError("");
    setNotice("");
    try {
      await request(`/platform/tenants/${t.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setNotice(`${t.name}: ${statusLabels[next]}.`);
      await load();
      if (selected?.id === t.id)
        await loadPayments({ ...t, status: next, effectiveStatus: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update status.");
    }
  }
  async function updateSubscription(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusyPayment(true);
    setError("");
    try {
      await request(`/platform/tenants/${selected.id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          planCode: subPlan,
          billingCycle: subCycle,
          priceAmount: Number(subPrice),
          currency: selected.currency || "INR",
        }),
      });
      setNotice(
        "Subscription plan updated. This does not confirm payment or activate access.",
      );
      await load();
      await loadPayments({
        ...selected,
        planCode: subPlan,
        billingCycle: subCycle,
        priceAmount: subPrice,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update subscription.",
      );
    } finally {
      setBusyPayment(false);
    }
  }
  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusyPayment(true);
    setError("");
    try {
      await request(`/platform/tenants/${selected.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentAmount),
          currency: selected.currency || "INR",
          method: "MANUAL",
          reference: paymentReference || undefined,
          notes: paymentNotes || undefined,
        }),
      });
      setNotice(
        "Payment recorded as PENDING. Verify receipt before confirming.",
      );
      setPaymentReference("");
      setPaymentNotes("");
      await loadPayments(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record payment.");
    } finally {
      setBusyPayment(false);
    }
  }
  async function confirmPayment(p: Payment) {
    if (!selected) return;
    const note = verificationNote.trim();
    if (note.length < 3) {
      setError("Enter how the payment was verified before confirming.");
      return;
    }
    if (
      !window.confirm(
        `Confirm ₹${p.amount} payment for ${selected.name}? This activates or renews access.`,
      )
    )
      return;
    setBusyPayment(true);
    setError("");
    try {
      await request(
        `/platform/tenants/${selected.id}/payments/${p.id}/confirm`,
        { method: "PATCH", body: JSON.stringify({ verificationNote: note }) },
      );
      setVerificationNote("");
      setNotice("Payment confirmed and subscription period updated.");
      await load();
      await loadPayments(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to confirm payment.");
    } finally {
      setBusyPayment(false);
    }
  }
  return (
    <div className="platform-layout saas-dashboard">
      <aside className="platform-sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Building2 size={21} />
          </div>
          <div>
            <strong>
              savvy<span>.</span>
            </strong>
            <small>SAAS CONTROL PLANE</small>
          </div>
        </div>
        <div className="platform-workspace-switch">
          <div className="platform-switch-icon">
            <ShieldCheck size={17} />
          </div>
          <div>
            <b>Savvy Platform</b>
            <small>Parent administration</small>
          </div>
          <span className="platform-live-dot" />
        </div>
        <div className="platform-label">PLATFORM MANAGEMENT</div>
        <button
          className={`platform-nav ${view === "overview" ? "active" : ""}`}
          onClick={() => setView("overview")}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>
        <button
          className={`platform-nav ${view === "tenants" ? "active" : ""}`}
          onClick={() => setView("tenants")}
        >
          <Building2 size={18} />
          <span>Tenant workspaces</span>
          <span className="nav-count">{tenants.length}</span>
        </button>
        <button
          className={`platform-nav ${view === "subscriptions" ? "active" : ""}`}
          onClick={() => setView("subscriptions")}
        >
          <Layers3 size={18} />
          <span>Subscriptions</span>
        </button>
        <button
          className={`platform-nav ${view === "payments" ? "active" : ""}`}
          onClick={() => setView("payments")}
        >
          <WalletCards size={18} />
          <span>Payment review</span>
          {pendingCount > 0 && (
            <span className="nav-count alert-count">{pendingCount}</span>
          )}
        </button>
        <div className="platform-sidebar-spacer" />
        <div className="platform-security-card">
          <div className="security-icon">
            <ShieldCheck size={17} />
          </div>
          <div>
            <b>Tenant isolation enabled</b>
            <span>
              Platform controls are separated from customer workspaces.
            </span>
          </div>
        </div>
        <div className="platform-profile">
          <div className="avatar">
            {(session.user.name || "SA")
              .split(/\s+/)
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <b>{session.user.name}</b>
            <small>Platform super admin</small>
          </div>
          <button onClick={onLogout} title="Sign out" aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="platform-main">
        <header className="platform-topbar">
          <div className="platform-breadcrumb">
            <span>Control plane</span>
            <ChevronRight size={14} />
            <strong>{viewTitles[view]}</strong>
          </div>
          <div className="platform-top-actions">
            <span className="system-live">
              <i /> Platform console
            </span>
            <button
              className="platform-refresh"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
              <span>Refresh</span>
            </button>
            <div className="platform-top-avatar">
              {(session.user.name || "SA")
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          </div>
        </header>
        <section className="platform-content">
          {view === "overview" ? (
            <div className="saas-hero">
              <div className="saas-hero-copy">
                <div className="saas-hero-kicker">
                  <Activity size={14} /> SAAS CONTROL CENTRE{" "}
                  <span>LIVE SNAPSHOT</span>
                </div>
                <h1>
                  Manage your entire
                  <br />
                  platform from one place.
                </h1>
                <p>
                  Onboard businesses, monitor subscription health, and manage
                  access across every customer workspace.
                </p>
                <div className="saas-hero-actions">
                  <button
                    className="hero-primary"
                    onClick={() => {
                      setForm(emptyForm);
                      setShowCreate(true);
                      setError("");
                    }}
                  >
                    <Plus size={16} /> Create customer
                  </button>
                  <button
                    className="hero-secondary"
                    onClick={() => setView("tenants")}
                  >
                    Explore workspaces <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
              <div className="saas-hero-art" aria-hidden="true">
                <div className="hero-orbit orbit-one" />
                <div className="hero-orbit orbit-two" />
                <div className="hero-orbit orbit-three" />
                <div className="hero-float-card hero-float-main">
                  <div className="hero-card-symbol">
                    <Layers3 size={17} />
                  </div>
                  <div>
                    <small>WORKSPACES</small>
                    <b>
                      {loading ? "—" : tenants.length.toLocaleString("en-IN")}
                    </b>
                  </div>
                  <span>
                    <TrendingUp size={13} />
                  </span>
                </div>
                <div className="hero-float-card hero-float-status">
                  <i />
                  <div>
                    <b>
                      {loading ? "Checking platform" : "Control plane ready"}
                    </b>
                    <small>Tenant access monitoring</small>
                  </div>
                </div>
                <div className="hero-mini-grid">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="hero-bottom-note">
                <ShieldCheck size={14} /> One application · Isolated customer
                data · Central control
              </div>
            </div>
          ) : (
            <div className="platform-page-heading">
              <div>
                <div className="eyebrow">
                  <span className="live-dot" /> PLATFORM MANAGEMENT
                </div>
                <h1>{viewTitles[view]}</h1>
                <p>{viewDescriptions[view]}</p>
              </div>
              <div className="platform-page-actions">
                <button
                  className="secondary-btn"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <RefreshCw size={15} /> Refresh
                </button>
                <button
                  className="primary-btn"
                  onClick={() => {
                    setForm(emptyForm);
                    setShowCreate(true);
                    setError("");
                  }}
                >
                  <Plus size={16} /> Add customer
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="platform-alert error">
              <AlertTriangle size={16} />
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="platform-alert success">
              <CheckCircle2 size={16} />
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                <X size={15} />
              </button>
            </div>
          )}
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
          {view === "overview" && (
            <>
              <div className="platform-overview-grid">
                <section className="panel portfolio-panel">
                  <div className="saas-panel-heading">
                    <div>
                      <h2>Subscription portfolio</h2>
                      <p>How customer workspaces are distributed by plan</p>
                    </div>
                    <div className="panel-heading-icon">
                      <Layers3 size={17} />
                    </div>
                  </div>
                  <div className="portfolio-total">
                    <div>
                      <span>Registered workspaces</span>
                      <strong>{loading ? "—" : tenants.length}</strong>
                    </div>
                    <span className="portfolio-total-badge">
                      <Building2 size={13} /> All plans
                    </span>
                  </div>
                  <div className="plan-breakdown">
                    {planBreakdown.map((item, i) => {
                      const percent = tenants.length
                        ? Math.round((item.count / tenants.length) * 100)
                        : 0;
                      return (
                        <div className="plan-breakdown-row" key={item.plan}>
                          <div className="plan-breakdown-label">
                            <span className={`plan-dot plan-dot-${i}`} />
                            <b>
                              {item.plan.charAt(0) +
                                item.plan.slice(1).toLowerCase()}
                            </b>
                            <span>
                              {item.count}{" "}
                              {item.count === 1 ? "workspace" : "workspaces"}
                            </span>
                            <strong>{percent}%</strong>
                          </div>
                          <div className="plan-track">
                            <div
                              className={`plan-fill plan-fill-${i}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="portfolio-foot">
                    <div>
                      <span className="foot-indicator active-indicator" />
                      <span>Active</span>
                      <b>{activeCount}</b>
                    </div>
                    <div>
                      <span className="foot-indicator trial-indicator" />
                      <span>Trial</span>
                      <b>{trialCount}</b>
                    </div>
                    <div>
                      <span className="foot-indicator issue-indicator" />
                      <span>Needs attention</span>
                      <b>{pendingCount + restrictedCount}</b>
                    </div>
                  </div>
                  <p className="mrr-disclaimer">
                    MRR is an estimate from configured prices for active
                    tenants, with annual prices normalized monthly. It is not a
                    payment-reconciliation total.
                  </p>
                </section>
                <section className="panel attention-panel">
                  <div className="saas-panel-heading">
                    <div>
                      <h2>Needs your attention</h2>
                      <p>Workspaces that may need an admin action</p>
                    </div>
                    <span
                      className={`attention-count ${attentionTenants.length ? "has-alert" : ""}`}
                    >
                      {attentionTenants.length}
                    </span>
                  </div>
                  {attentionTenants.length === 0 ? (
                    <div className="attention-empty">
                      <div className="attention-empty-icon">
                        <CheckCircle2 size={22} />
                      </div>
                      <b>Everything looks in good shape</b>
                      <span>
                        No suspended, expired, inactive, or payment-pending
                        workspaces in this list.
                      </span>
                    </div>
                  ) : (
                    <div className="attention-list">
                      {attentionTenants.map((t) => (
                        <button
                          className="attention-item"
                          key={t.id}
                          onClick={() => void loadPayments(t)}
                        >
                          <span
                            className={`attention-item-icon ${t.effectiveStatus.toLowerCase()}`}
                          >
                            {t.effectiveStatus === "PAYMENT_PENDING" ? (
                              <CreditCard size={16} />
                            ) : t.effectiveStatus === "SUSPENDED" ? (
                              <Power size={16} />
                            ) : (
                              <Clock3 size={16} />
                            )}
                          </span>
                          <span className="attention-item-copy">
                            <b>{t.name}</b>
                            <small>
                              {t.effectiveStatus === "PAYMENT_PENDING"
                                ? "Payment confirmation required"
                                : t.effectiveStatus === "SUSPENDED"
                                  ? "Access has been suspended"
                                  : t.effectiveStatus === "EXPIRED"
                                    ? "Subscription validity has ended"
                                    : "Workspace is inactive"}
                            </small>
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    className="attention-footer"
                    onClick={() => setView("payments")}
                  >
                    Open payment review <ArrowUpRight size={14} />
                  </button>
                </section>
              </div>
              <section className="panel recent-workspaces-panel">
                <div className="saas-panel-heading recent-heading">
                  <div>
                    <h2>Recently added workspaces</h2>
                    <p>Latest businesses registered on your platform</p>
                  </div>
                  <button
                    className="view-all-button"
                    onClick={() => setView("tenants")}
                  >
                    View all workspaces <ArrowUpRight size={14} />
                  </button>
                </div>
                {loading ? (
                  <div className="recent-empty">Loading workspace data…</div>
                ) : recentTenants.length === 0 ? (
                  <div className="recent-empty">
                    <div className="empty-building">
                      <Building2 size={23} />
                    </div>
                    <b>Your platform is ready for its first customer</b>
                    <span>
                      Create a tenant workspace to get started with your SaaS
                      business.
                    </span>
                    <button
                      className="primary-btn"
                      onClick={() => {
                        setForm(emptyForm);
                        setShowCreate(true);
                      }}
                    >
                      {" "}
                      <Plus size={15} /> Create first customer
                    </button>
                  </div>
                ) : (
                  <div className="recent-workspace-list">
                    {recentTenants.map((t) => (
                      <div className="recent-workspace-row" key={t.id}>
                        <div className="recent-company-icon">
                          <Building2 size={17} />
                        </div>
                        <div className="recent-company-name">
                          <b>{t.name}</b>
                          <small>
                            {t.slug}
                            {t.ownerEmail ? ` · ${t.ownerEmail}` : ""}
                          </small>
                        </div>
                        <span
                          className={`plan-chip ${t.planCode.toLowerCase()}`}
                        >
                          {t.planCode}
                        </span>
                        <span
                          className={`tenant-status ${t.effectiveStatus.toLowerCase()}`}
                        >
                          <i />
                          {statusLabels[t.effectiveStatus]}
                        </span>
                        <span className="recent-date">
                          <CalendarDays size={13} />
                          {new Date(t.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <button
                          className="recent-manage"
                          onClick={() => void loadPayments(t)}
                        >
                          Manage <ChevronRight size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          {view !== "overview" && (
            <section className="panel tenant-table-panel">
              <div className="tenant-table-heading">
                <div>
                  <h2>
                    {view === "tenants"
                      ? "All customer workspaces"
                      : view === "subscriptions"
                        ? "Plans & subscriptions"
                        : "Tenants awaiting payment"}
                  </h2>
                  <p>
                    {view === "tenants"
                      ? "Manage tenant details, access status and workspace membership."
                      : view === "subscriptions"
                        ? "Review each tenant’s configured plan, pricing and subscription validity."
                        : "These workspaces have an effective payment-pending status. Open a tenant to review its payment history."}
                  </p>
                </div>
                <button
                  className="secondary-btn"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>
              <div className="tenant-toolbar">
                <div className="search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, workspace or plan…"
                  />
                </div>
                <span>
                  {filtered.length} workspace{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="table-scroll">
                <table className="tenant-table">
                  <thead>
                    <tr>
                      <th>CUSTOMER / WORKSPACE</th>
                      <th>PLAN</th>
                      <th>MEMBERS</th>
                      <th>STATUS</th>
                      <th>VALID UNTIL</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="tenant-empty">
                          Loading tenant workspaces…
                        </td>
                      </tr>
                    ) : (
                      filtered.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <div className="tenant-ident">
                              <div className="tenant-avatar">
                                <Building2 size={17} />
                              </div>
                              <div>
                                <b>{t.name}</b>
                                <small>
                                  {t.slug}
                                  {t.ownerEmail
                                    ? ` · Owner: ${t.ownerEmail}`
                                    : ""}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`plan-chip ${t.planCode.toLowerCase()}`}
                            >
                              {t.planCode}
                            </span>
                            <small className="cell-secondary">
                              {t.priceAmount
                                ? `${t.currency} ${t.priceAmount} / ${t.billingCycle.toLowerCase()}`
                                : "Price not set"}
                            </small>
                          </td>
                          <td>
                            <span className="member-count">
                              <Users size={14} />
                              {t.memberCount}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`tenant-status ${t.effectiveStatus.toLowerCase()}`}
                            >
                              <i />
                              {statusLabels[t.effectiveStatus]}
                            </span>
                          </td>
                          <td>
                            <span className="created-date">
                              <CalendarDays size={13} />
                              {t.currentPeriodEndsAt || t.trialEndsAt
                                ? new Date(
                                    t.currentPeriodEndsAt || t.trialEndsAt!,
                                  ).toLocaleDateString("en-IN")
                                : "—"}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="access-btn manage"
                                onClick={() => void loadPayments(t)}
                              >
                                <History size={14} /> Manage
                              </button>
                              <button
                                className={`access-btn ${t.status === "SUSPENDED" ? "activate" : "suspend"}`}
                                disabled={
                                  t.effectiveStatus === "EXPIRED" ||
                                  t.effectiveStatus === "PAYMENT_PENDING"
                                }
                                onClick={() => void changeStatus(t)}
                                title={
                                  t.status === "SUSPENDED"
                                    ? "Reactivate only if subscription is valid"
                                    : "Suspend tenant"
                                }
                              >
                                <Power size={14} />
                                {t.status === "SUSPENDED"
                                  ? "Reactivate"
                                  : "Suspend"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="tenant-empty">
                          {view === "payments"
                            ? "No tenants currently require payment confirmation."
                            : "No workspaces match your search."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="tenant-table-footer">
                <ShieldCheck size={15} />
                <span>
                  Tenant access is evaluated by backend authorization and
                  subscription rules. Platform controls do not replace
                  tenant-level permissions.
                </span>
              </div>
            </section>
          )}
          <div className="platform-foot">
            © 2026 Savvy Platform{" "}
            <span>
              <ShieldCheck size={13} /> Platform administration · Tenant data
              remains isolated
            </span>
          </div>
        </section>
      </main>
      {showCreate && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <section
            className="create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">NEW CUSTOMER</div>
                <h2 id="create-title">Create workspace</h2>
                <p>
                  Set up a tenant and its first owner account. No paid access is
                  granted until a payment is verified.
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowCreate(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={create}>
              <div className="form-grid">
                <label>
                  Company / business name
                  <input
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                        slug:
                          form.slug ||
                          e.target.value
                            .toLowerCase()
                            .trim()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, ""),
                      })
                    }
                    placeholder="Acme Operations"
                  />
                </label>
                <label>
                  Workspace slug
                  <input
                    required
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    value={form.slug}
                    onChange={(e) =>
                      setForm({ ...form, slug: e.target.value.toLowerCase() })
                    }
                    placeholder="acme-operations"
                  />
                  <small>
                    Used on tenant login; letters, numbers and hyphens.
                  </small>
                </label>
                <label>
                  Contact person
                  <input
                    value={form.contactName}
                    onChange={(e) =>
                      setForm({ ...form, contactName: e.target.value })
                    }
                    placeholder="Business owner"
                  />
                </label>
                <label>
                  Business contact email
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                    placeholder="contact@company.com"
                  />
                </label>
                <label>
                  Contact phone
                  <input
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm({ ...form, contactPhone: e.target.value })
                    }
                    placeholder="+91…"
                  />
                </label>
                <label>
                  Owner full name
                  <input
                    required
                    value={form.ownerName}
                    onChange={(e) =>
                      setForm({ ...form, ownerName: e.target.value })
                    }
                    placeholder="Customer admin"
                  />
                </label>
                <label>
                  Owner login email
                  <input
                    required
                    type="email"
                    value={form.ownerEmail}
                    onChange={(e) =>
                      setForm({ ...form, ownerEmail: e.target.value })
                    }
                    placeholder="admin@company.com"
                  />
                </label>
                <label>
                  Temporary password
                  <input
                    required
                    minLength={12}
                    type="password"
                    autoComplete="new-password"
                    value={form.ownerPassword}
                    onChange={(e) =>
                      setForm({ ...form, ownerPassword: e.target.value })
                    }
                    placeholder="At least 12 characters"
                  />
                  <small>Use an out-of-band secure handoff.</small>
                </label>
                <label>
                  Subscription plan
                  <select
                    value={form.planCode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        planCode: e.target.value as TenantForm["planCode"],
                      })
                    }
                  >
                    <option value="STARTER">Starter</option>
                    <option value="GROWTH">Growth</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </label>
                <label>
                  Price (INR)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.priceAmount}
                    onChange={(e) =>
                      setForm({ ...form, priceAmount: e.target.value })
                    }
                    placeholder="Optional configured price"
                  />
                </label>
                <label>
                  Billing cycle
                  <select
                    value={form.billingCycle}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        billingCycle: e.target
                          .value as TenantForm["billingCycle"],
                      })
                    }
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                </label>
                <label>
                  Trial length (days)
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={form.trialDays}
                    onChange={(e) =>
                      setForm({ ...form, trialDays: Number(e.target.value) })
                    }
                  />
                  <small>Enter 0 to require payment before access.</small>
                </label>
              </div>
              <div className="modal-note">
                <ShieldCheck size={17} />
                <span>
                  Trial access expires automatically. Zero-day trials remain
                  payment-pending; activation happens only after a verified
                  payment.
                </span>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Creating…" : "Create workspace"} <Plus size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="manage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">TENANT MANAGEMENT</div>
                <h2 id="manage-title">{selected.name}</h2>
                <p>
                  Tenant ID: {selected.id} · {selected.slug} ·{" "}
                  {statusLabels[selected.effectiveStatus]} · created{" "}
                  {new Date(selected.createdAt).toLocaleDateString()}
                  <br />
                  Owner: {selected.ownerName ?? "—"} (
                  {selected.ownerEmail ?? "—"}) · Contact:{" "}
                  {selected.contactName ?? "—"} · {selected.contactEmail ?? "—"}{" "}
                  · {selected.contactPhone ?? "—"}
                </p>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>
            {error && <div className="platform-alert error">{error}</div>}
            <form className="subscription-form" onSubmit={updateSubscription}>
              <h3>
                <Layers3 size={16} /> Subscription settings
              </h3>
              <div className="form-grid">
                <label>
                  Plan
                  <select
                    value={subPlan}
                    onChange={(e) =>
                      setSubPlan(e.target.value as typeof subPlan)
                    }
                  >
                    <option value="STARTER">Starter</option>
                    <option value="GROWTH">Growth</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </label>
                <label>
                  Cycle
                  <select
                    value={subCycle}
                    onChange={(e) =>
                      setSubCycle(e.target.value as typeof subCycle)
                    }
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                </label>
                <label>
                  Price (INR)
                  <input
                    required
                    min="0"
                    type="number"
                    step="0.01"
                    value={subPrice}
                    onChange={(e) => setSubPrice(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="secondary-btn"
                disabled={busyPayment}
                type="submit"
              >
                Save subscription settings
              </button>
              <small>
                Changing plan or price does not itself activate or renew access.
              </small>
            </form>
            <form className="subscription-form" onSubmit={recordPayment}>
              <h3>
                <CreditCard size={16} /> Record a payment
              </h3>
              <div className="form-grid">
                <label>
                  Amount (INR)
                  <input
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </label>
                <label>
                  Bank / UPI / receipt reference
                  <input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Transaction ID (optional)"
                  />
                </label>
                <label>
                  Notes
                  <input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Receipt or verification context"
                  />
                </label>
              </div>
              <button
                className="primary-btn"
                disabled={busyPayment}
                type="submit"
              >
                Record as pending
              </button>
            </form>
            <section className="payment-history">
              <h3>
                <History size={16} /> Payment history
              </h3>
              {payments.length === 0 ? (
                <p className="no-payments">
                  No payments have been recorded for this tenant.
                </p>
              ) : (
                payments.map((p) => (
                  <div className="payment-row" key={p.id}>
                    <div>
                      <b>
                        {p.currency} {p.amount}
                      </b>
                      <small>
                        {p.method} · {new Date(p.createdAt).toLocaleString()}
                        {p.reference ? ` · Ref: ${p.reference}` : ""}
                      </small>
                      <small>
                        Recorded by {p.createdBy.name}
                        {p.confirmedBy
                          ? ` · Confirmed by ${p.confirmedBy.name}`
                          : ""}
                      </small>
                      {p.notes && <small>{p.notes}</small>}
                    </div>
                    <div className="payment-actions">
                      <span
                        className={`payment-pill ${p.status.toLowerCase()}`}
                      >
                        {p.status}
                      </span>
                      {p.status === "PENDING" && (
                        <button
                          className="access-btn activate"
                          disabled={busyPayment}
                          onClick={() => void confirmPayment(p)}
                        >
                          <CheckCircle2 size={14} /> Confirm
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {payments.some((p) => p.status === "PENDING") && (
                <label className="verify-note">
                  Payment verification note
                  <input
                    required
                    minLength={3}
                    maxLength={1000}
                    value={verificationNote}
                    onChange={(e) => setVerificationNote(e.target.value)}
                    placeholder="e.g. Checked bank statement / UPI reference"
                  />
                  <small>
                    Only confirm after independently verifying receipt.
                  </small>
                </label>
              )}
            </section>
          </section>
        </div>
      )}
    </div>
  );
}
