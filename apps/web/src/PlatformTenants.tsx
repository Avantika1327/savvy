import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, CircleCheck, Clock3, Banknote, CreditCard, ShieldCheck } from "lucide-react";
import type { Session } from "./authTypes";
import { emptyForm, statusLabels } from "./platform-admin/constants";
import type { Payment, PlatformMetric, PlatformView, Tenant, TenantForm, TenantStatus } from "./platform-admin/types";
import PlatformSidebar from "./platform-admin/components/PlatformSidebar";
import PlatformTopbar from "./platform-admin/components/PlatformTopbar";
import PlatformPageHeading from "./platform-admin/components/PlatformPageHeading";
import PlatformAlerts from "./platform-admin/components/PlatformAlerts";
import PlatformMetrics from "./platform-admin/components/PlatformMetrics";
import OverviewPage from "./platform-admin/pages/OverviewPage";
import TenantWorkspacesPage from "./platform-admin/pages/TenantWorkspacesPage";
import PaymentReviewPage from "./platform-admin/pages/PaymentReviewPage";
import "./platform-admin/platform-pages.css";
import CreateTenantModal from "./platform-admin/components/CreateTenantModal";
import ManageTenantModal from "./platform-admin/components/ManageTenantModal";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
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
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const view: PlatformView =
    path === "/platform-admin/tenants"
      ? "tenants"
      : path === "/platform-admin/payments"
        ? "payments"
        : "overview";
  const setView = (nextView: PlatformView) => {
    const routes: Record<PlatformView, string> = {
      overview: "/platform-admin",
      tenants: "/platform-admin/tenants",
      payments: "/platform-admin/payments",
    };
    navigate(routes[nextView]);
  };
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
  const metrics: PlatformMetric[] = [
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
  const viewTitles: Record<PlatformView, string> = {
    overview: "Platform overview",
    tenants: "Tenant workspaces",
    payments: "Payment review queue",
  };
  const viewDescriptions: Record<PlatformView, string> = {
    overview: "Your SaaS business at a glance.",
    tenants: "Manage customer workspaces and access.",
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
  } return (
    <div className="platform-layout saas-dashboard">
      <PlatformSidebar
        view={view}
        setView={setView}
        tenants={tenants}
        pendingCount={pendingCount}
        session={session}
        onLogout={onLogout}
      />
      <main className="platform-main">
        <PlatformTopbar
          view={view}
          viewTitles={viewTitles}
          loading={loading}
          onRefresh={() => void load()}
          session={session}
        />
        <section className="platform-content">
          <PlatformPageHeading
            view={view}
            viewTitles={viewTitles}
            viewDescriptions={viewDescriptions}
            loading={loading}
            tenantCount={tenants.length}
            onCreate={() => {
              setForm(emptyForm);
              setShowCreate(true);
              setError("");
            }}
            onOpenTenants={() => setView("tenants")}
            onRefresh={() => void load()}
          />
          <PlatformAlerts
            error={error}
            notice={notice}
            onDismissError={() => setError("")}
            onDismissNotice={() => setNotice("")}
          />
          {view === "overview" && <PlatformMetrics metrics={metrics} loading={loading} />}
          {view === "overview" && (
            <OverviewPage
              loading={loading}
              tenants={tenants}
              planBreakdown={planBreakdown}
              activeCount={activeCount}
              trialCount={trialCount}
              pendingCount={pendingCount}
              restrictedCount={restrictedCount}
              attentionTenants={attentionTenants}
              recentTenants={recentTenants}
              statusLabels={statusLabels}
              onOpenTenant={(tenant) => void loadPayments(tenant)}
              onOpenPaymentReview={() => setView("payments")}
              onOpenTenants={() => setView("tenants")}
              onCreateTenant={() => {
                setForm(emptyForm);
                setShowCreate(true);
                setError("");
              }}
            />
          )}
          {view === "tenants" && (
            <TenantWorkspacesPage
              loading={loading}
              tenants={filtered}
              search={search}
              onSearchChange={setSearch}
              statusLabels={statusLabels}
              onOpenTenant={(tenant) => void loadPayments(tenant)}
              onChangeStatus={(tenant) => void changeStatus(tenant)}
            />
          )}
          {view === "payments" && (
            <PaymentReviewPage
              loading={loading}
              tenants={filtered}
              search={search}
              onSearchChange={setSearch}
              statusLabels={statusLabels}
              onReviewPayment={(tenant) => void loadPayments(tenant)}
            />
          )}
          <div className="platform-foot">
            © 2026 Savvy Platform{" "}
            <span><ShieldCheck size={13} /> Platform administration · Tenant data remains isolated</span>
          </div>
        </section>
      </main>
      <CreateTenantModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={create}
        form={form}
        setForm={setForm}
        saving={saving}
      />
      <ManageTenantModal
        selected={selected}
        onClose={() => setSelected(null)}
        statusLabels={statusLabels}
        error={error}
        subPlan={subPlan}
        setSubPlan={setSubPlan}
        subCycle={subCycle}
        setSubCycle={setSubCycle}
        subPrice={subPrice}
        setSubPrice={setSubPrice}
        busyPayment={busyPayment}
        onUpdateSubscription={updateSubscription}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        paymentReference={paymentReference}
        setPaymentReference={setPaymentReference}
        paymentNotes={paymentNotes}
        setPaymentNotes={setPaymentNotes}
        onRecordPayment={recordPayment}
        payments={payments}
        verificationNote={verificationNote}
        setVerificationNote={setVerificationNote}
        onConfirmPayment={(payment) => void confirmPayment(payment)}
      />
    </div>
  );
}
