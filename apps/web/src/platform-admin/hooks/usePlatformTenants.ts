import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Banknote, Building2, CircleCheck, Clock3, CreditCard } from "lucide-react";
import { emptyForm, statusLabels } from "../constants";
import type {
  Payment,
  PlatformMetric,
  Tenant,
  TenantForm,
  TenantStatus,
} from "../types";
import { platformRequest } from "../services/platformApi";

const PLANS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;

type ApiList<T> = { data?: T[] };
type ApiData<T> = { data?: T };

export function usePlatformTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
  const [subPlan, setSubPlan] = useState<TenantForm["planCode"]>("STARTER");
  const [subCycle, setSubCycle] = useState<TenantForm["billingCycle"]>("MONTHLY");

  const load = useCallback(async (): Promise<Tenant[]> => {
    setLoading(true);
    setError("");
    try {
      const result = await platformRequest<ApiList<Tenant>>("/platform/tenants");
      const nextTenants = Array.isArray(result.data) ? result.data : [];
      setTenants(nextTenants);
      return nextTenants;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load tenants.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPayments = useCallback(async (tenant: Tenant) => {
    setSelected(tenant);
    setPaymentAmount(tenant.priceAmount ?? "");
    setSubPrice(tenant.priceAmount ?? "");
    setSubPlan(PLANS.includes(tenant.planCode.toUpperCase() as (typeof PLANS)[number])
      ? (tenant.planCode.toUpperCase() as TenantForm["planCode"])
      : "STARTER");
    setSubCycle(tenant.billingCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY");
    setPayments([]);
    setError("");

    try {
      const result = await platformRequest<ApiList<Payment>>(
        `/platform/tenants/${encodeURIComponent(tenant.id)}/payments`,
      );
      setPayments(Array.isArray(result.data) ? result.data : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load payment history.");
    }
  }, []);

  const create = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        ...form,
        contactName: form.contactName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        priceAmount: form.priceAmount === "" ? undefined : Number(form.priceAmount),
      };
      await platformRequest<ApiData<Tenant>>("/platform/tenants", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setShowCreate(false);
      setForm(emptyForm);
      setNotice(
        "Tenant created. Trial access is time-limited; customers without a trial remain payment-pending until a payment is explicitly verified.",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create tenant.");
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const changeStatus = useCallback(async (tenant: Tenant) => {
    const nextStatus: TenantStatus = tenant.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    const confirmation = nextStatus === "SUSPENDED"
      ? `Suspend ${tenant.name}? Tenant API access should be blocked by the backend.`
      : `Request reactivation for ${tenant.name}? The backend must confirm the subscription is still valid.`;
    if (!window.confirm(confirmation)) return;

    setError("");
    setNotice("");
    try {
      await platformRequest(`/platform/tenants/${encodeURIComponent(tenant.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(`${tenant.name}: ${statusLabels[nextStatus]}.`);
      const refreshedTenants = await load();
      if (selected?.id === tenant.id) {
        const refreshedTenant = refreshedTenants.find((item) => item.id === tenant.id)
          ?? { ...tenant, status: nextStatus, effectiveStatus: nextStatus };
        await loadPayments(refreshedTenant);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update status.");
    }
  }, [load, loadPayments, selected]);

  const updateSubscription = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const price = Number(subPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid subscription price.");
      return;
    }

    setBusyPayment(true);
    setError("");
    setNotice("");
    try {
      await platformRequest(`/platform/tenants/${encodeURIComponent(selected.id)}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          planCode: subPlan,
          billingCycle: subCycle,
          priceAmount: price,
          currency: selected.currency || "INR",
        }),
      });
      setNotice("Subscription plan updated. This does not confirm payment or activate access.");
      const refreshedTenants = await load();
      const refreshedTenant = refreshedTenants.find((item) => item.id === selected.id)
        ?? { ...selected, planCode: subPlan, billingCycle: subCycle, priceAmount: String(price) };
      await loadPayments(refreshedTenant);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update subscription.");
    } finally {
      setBusyPayment(false);
    }
  }, [load, loadPayments, selected, subCycle, subPlan, subPrice]);

  const recordPayment = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }

    setBusyPayment(true);
    setError("");
    setNotice("");
    try {
      await platformRequest(`/platform/tenants/${encodeURIComponent(selected.id)}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          currency: selected.currency || "INR",
          method: "MANUAL",
          reference: paymentReference.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
        }),
      });
      setNotice("Payment recorded as PENDING. Verify receipt before confirming.");
      setPaymentReference("");
      setPaymentNotes("");
      await loadPayments(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record payment.");
    } finally {
      setBusyPayment(false);
    }
  }, [loadPayments, paymentAmount, paymentNotes, paymentReference, selected]);

  const confirmPayment = useCallback(async (payment: Payment) => {
    if (!selected) return;
    const note = verificationNote.trim();
    if (note.length < 3) {
      setError("Enter how the payment was verified before confirming.");
      return;
    }
    if (!window.confirm(`Confirm ₹${payment.amount} payment for ${selected.name}? This activates or renews access.`)) return;

    setBusyPayment(true);
    setError("");
    setNotice("");
    try {
      await platformRequest(
        `/platform/tenants/${encodeURIComponent(selected.id)}/payments/${encodeURIComponent(payment.id)}/confirm`,
        { method: "PATCH", body: JSON.stringify({ verificationNote: note }) },
      );
      setVerificationNote("");
      setNotice("Payment confirmed and subscription period updated.");
      const refreshedTenants = await load();
      await loadPayments(refreshedTenants.find((item) => item.id === selected.id) ?? selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to confirm payment.");
    } finally {
      setBusyPayment(false);
    }
  }, [load, loadPayments, selected, verificationNote]);

  const derived = useMemo(() => {
    const activeCount = tenants.filter((tenant) => tenant.effectiveStatus === "ACTIVE").length;
    const trialCount = tenants.filter((tenant) => tenant.effectiveStatus === "TRIAL").length;
    const pendingCount = tenants.filter((tenant) => tenant.effectiveStatus === "PAYMENT_PENDING").length;
    const restrictedCount = tenants.filter((tenant) =>
      ["SUSPENDED", "EXPIRED", "INACTIVE"].includes(tenant.effectiveStatus),
    ).length;
    const monthlyValue = tenants
      .filter((tenant) => tenant.effectiveStatus === "ACTIVE" && tenant.priceAmount !== null)
      .reduce((total, tenant) => {
        const amount = Number(tenant.priceAmount);
        if (!Number.isFinite(amount) || amount < 0) return total;
        return total + amount / (tenant.billingCycle === "ANNUAL" ? 12 : 1);
      }, 0);

    const money = (value: number) => new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

    const metrics: PlatformMetric[] = [
      { label: "Total workspaces", value: String(tenants.length), hint: "Customer businesses", icon: Building2, color: "violet" },
      { label: "Active subscriptions", value: String(activeCount), hint: "Access currently enabled", icon: CircleCheck, color: "mint" },
      { label: "Trial accounts", value: String(trialCount), hint: "Time-limited access", icon: Clock3, color: "blue" },
      { label: "Estimated MRR", value: money(monthlyValue), hint: "Configured active pricing", icon: Banknote, color: "violet" },
      { label: "Payment review", value: String(pendingCount), hint: "Awaiting verification", icon: CreditCard, color: "amber" },
    ];

    const planBreakdown = PLANS.map((plan) => ({
      plan,
      count: tenants.filter((tenant) => tenant.planCode.toUpperCase() === plan).length,
    }));
    const recentTenants = [...tenants]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    const attentionRank: Record<TenantStatus, number> = {
      PAYMENT_PENDING: 0, SUSPENDED: 1, EXPIRED: 2, INACTIVE: 3, ACTIVE: 4, TRIAL: 5,
    };
    const attentionTenants = [...tenants]
      .filter((tenant) => ["PAYMENT_PENDING", "SUSPENDED", "EXPIRED", "INACTIVE"].includes(tenant.effectiveStatus))
      .sort((a, b) => attentionRank[a.effectiveStatus] - attentionRank[b.effectiveStatus])
      .slice(0, 4);

    return { activeCount, trialCount, pendingCount, restrictedCount, monthlyValue, metrics, planBreakdown, recentTenants, attentionTenants };
  }, [tenants]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesSearch = !query || [
        tenant.name,
        tenant.slug,
        tenant.planCode,
        tenant.ownerName,
        tenant.ownerEmail,
        tenant.contactName,
        tenant.contactEmail,
        tenant.contactPhone,
        tenant.subscriptionStatus,
        statusLabels[tenant.effectiveStatus],
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
      return matchesSearch;
    });
  }, [search, tenants]);

  return {
    tenants,
    loading,
    search,
    setSearch,
    showCreate,
    setShowCreate,
    form,
    setForm,
    error,
    setError,
    notice,
    setNotice,
    saving,
    selected,
    setSelected,
    payments,
    paymentAmount,
    setPaymentAmount,
    paymentReference,
    setPaymentReference,
    paymentNotes,
    setPaymentNotes,
    verificationNote,
    setVerificationNote,
    busyPayment,
    subPrice,
    setSubPrice,
    subPlan,
    setSubPlan,
    subCycle,
    setSubCycle,
    load,
    loadPayments,
    create,
    changeStatus,
    updateSubscription,
    recordPayment,
    confirmPayment,
    filtered,
    ...derived,
  };
}
