import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import type { Session } from "./authTypes";
import { emptyForm, statusLabels } from "./platform-admin/constants";
import type { PlatformView } from "./platform-admin/types";
import PlatformSidebar from "./platform-admin/components/PlatformSidebar";
import PlatformTopbar from "./platform-admin/components/PlatformTopbar";
import PlatformPageHeading from "./platform-admin/components/PlatformPageHeading";
import PlatformAlerts from "./platform-admin/components/PlatformAlerts";
import PlatformMetrics from "./platform-admin/components/PlatformMetrics";
import OverviewPage from "./platform-admin/pages/OverviewPage";
import TenantWorkspacesPage from "./platform-admin/pages/TenantWorkspacesPage";
import PaymentReviewPage from "./platform-admin/pages/PaymentReviewPage";
import TenantDetailPage from "./platform-admin/pages/TenantDetailPage";
import TenantTrashPage from "./platform-admin/pages/TenantTrashPage";
import CreateTenantModal from "./platform-admin/components/CreateTenantModal";
import ManageTenantModal from "./platform-admin/components/ManageTenantModal";
import { usePlatformTenants } from "./platform-admin/hooks/usePlatformTenants";
import "./platform-admin/platform-pages.css";

type Props = {
  session: Session;
  onLogout: () => void;
};

const ROUTES: Record<PlatformView, string> = {
  overview: "/platform-admin",
  tenants: "/platform-admin/tenants",
  payments: "/platform-admin/payments",
};

const VIEW_TITLES: Record<PlatformView, string> = {
  overview: "Platform overview",
  tenants: "Tenant workspaces",
  payments: "Payment review queue",
};

const VIEW_DESCRIPTIONS: Record<PlatformView, string> = {
  overview: "Your SaaS business at a glance.",
  tenants: "Manage customer workspaces and access.",
  payments: "Follow up on tenants that still require payment confirmation.",
};

function getView(path: string): PlatformView | null {
  const normalized = path.replace(/\/+$/, "") || "/";
  if (normalized === "/platform-admin") return "overview";
  if (normalized === "/platform-admin/tenants" || normalized.startsWith("/platform-admin/tenants/")) return "tenants";
  if (normalized === "/platform-admin/payments") return "payments";
      return null;
  }

export default function PlatformTenants({ session, onLogout }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = usePlatformTenants();
  // The child <Routes> below control which page renders. This value is only used
  // to keep shared navigation and headings in sync with the current URL.
  const view = getView(location.pathname) ?? "overview";
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const isTrashRoute = normalizedPath === "/platform-admin/tenants/trash";
  const isTenantDetailRoute = normalizedPath.startsWith("/platform-admin/tenants/") && !isTrashRoute;
  const isNestedTenantPage = isTrashRoute || isTenantDetailRoute;
  const filteredTenants = view === "payments"
    ? state.filtered.filter((tenant) => tenant.effectiveStatus === "PAYMENT_PENDING")
    : state.filtered;

  const setView = (nextView: PlatformView) => navigate(ROUTES[nextView]);

  return (
    <div className="platform-layout saas-dashboard">
      <PlatformSidebar
        view={view}
        setView={setView}
        tenants={state.tenants}
        pendingCount={state.pendingCount}
        session={session}
        onLogout={onLogout}
      />
      <main className="platform-main">
        <PlatformTopbar
          view={view}
          viewTitles={VIEW_TITLES}
          loading={state.loading}
          onRefresh={() => void state.load()}
          session={session}
        />
        <section className="platform-content">
          {!isNestedTenantPage && (
          <PlatformPageHeading
            view={view}
            viewTitles={VIEW_TITLES}
            viewDescriptions={VIEW_DESCRIPTIONS}
            loading={state.loading}
            tenantCount={state.tenants.length}
            onCreate={() => {
              state.setForm(emptyForm);
              state.setShowCreate(true);
              state.setError("");
            }}
            onOpenTenants={() => setView("tenants")}
            onRefresh={() => void state.load()}
          />
          )}
          <PlatformAlerts
            error={state.error}
            notice={state.notice}
            onDismissError={() => state.setError("")}
            onDismissNotice={() => state.setNotice("")}
          />

          <Routes>
            <Route
              index
              element={
                <>
                  <PlatformMetrics metrics={state.metrics} loading={state.loading} />
                  <OverviewPage
                    loading={state.loading}
                    tenants={state.tenants}
                    planBreakdown={state.planBreakdown}
                    activeCount={state.activeCount}
                    trialCount={state.trialCount}
                    pendingCount={state.pendingCount}
                    restrictedCount={state.restrictedCount}
                    attentionTenants={state.attentionTenants}
                    recentTenants={state.recentTenants}
                    statusLabels={statusLabels}
                    onOpenTenant={(tenant) => void state.loadPayments(tenant)}
                    onOpenPaymentReview={() => setView("payments")}
                    onOpenTenants={() => setView("tenants")}
                    onCreateTenant={() => {
                      state.setForm(emptyForm);
                      state.setShowCreate(true);
                      state.setError("");
                    }}
                  />
                </>
              }
            />
            <Route
              path="tenants"
              element={
                <TenantWorkspacesPage
                  loading={state.loading}
                  tenants={filteredTenants}
                  search={state.search}
                  onSearchChange={state.setSearch}
                  statusLabels={statusLabels}
                  onOpenTenant={(tenant) => void state.loadPayments(tenant)}
                  onViewDetails={(tenant) => navigate(`/platform-admin/tenants/${encodeURIComponent(tenant.id)}`)}
                  onOpenTrash={() => navigate("/platform-admin/tenants/trash")}
                  onChangeStatus={(tenant) => void state.changeStatus(tenant)}
                />
              }
            />
            <Route
              path="tenants/:tenantId"
              element={
                <TenantDetailPage
                  tenants={state.tenants}
                  loading={state.loading}
                  statusLabels={statusLabels}
                  saving={state.tenantSaving}
                  deleting={state.tenantDeleting}
                  onBack={() => navigate("/platform-admin/tenants")}
                  onSave={state.updateTenant}
                  onManageSubscription={(tenant) => void state.loadPayments(tenant)}
                  onChangeStatus={(tenant) => void state.changeStatus(tenant)}
                  onSoftDelete={state.softDeleteTenant}
                />
              }
            />
            <Route
              path="tenants/trash"
              element={
                <TenantTrashPage
                  tenants={state.trashTenants}
                  loading={state.trashLoading}
                  busyDeleting={state.tenantDeleting}
                  statusLabels={statusLabels}
                  onLoad={state.loadTrash}
                  onRestore={state.restoreTenant}
                  onPermanentDelete={state.permanentlyDeleteTenant}
                />
              }
            />
            <Route
              path="payments"
              element={
                <PaymentReviewPage
                  loading={state.loading}
                  tenants={filteredTenants}
                  search={state.search}
                  onSearchChange={state.setSearch}
                  statusLabels={statusLabels}
                  onReviewPayment={(tenant) => void state.loadPayments(tenant)}
                />
              }
            />
            <Route path="*" element={<Navigate to={ROUTES.overview} replace />} />
          </Routes>

          <div className="platform-foot">
            © 2026 Savvy Platform{" "}
            <span><ShieldCheck size={13} /> Platform administration · Tenant data remains isolated</span>
          </div>
        </section>
      </main>

      <CreateTenantModal
        open={state.showCreate}
        onClose={() => state.setShowCreate(false)}
        onSubmit={state.create}
        form={state.form}
        setForm={state.setForm}
        saving={state.saving}
      />

      <ManageTenantModal
        selected={state.selected}
        onClose={() => state.setSelected(null)}
        statusLabels={statusLabels}
        error={state.error}
        subPlan={state.subPlan}
        setSubPlan={state.setSubPlan}
        subCycle={state.subCycle}
        setSubCycle={state.setSubCycle}
        subPrice={state.subPrice}
        setSubPrice={state.setSubPrice}
        busyPayment={state.busyPayment}
        onUpdateSubscription={state.updateSubscription}
        paymentAmount={state.paymentAmount}
        setPaymentAmount={state.setPaymentAmount}
        paymentReference={state.paymentReference}
        setPaymentReference={state.setPaymentReference}
        paymentNotes={state.paymentNotes}
        setPaymentNotes={state.setPaymentNotes}
        onRecordPayment={state.recordPayment}
        payments={state.payments}
        verificationNote={state.verificationNote}
        setVerificationNote={state.setVerificationNote}
        onConfirmPayment={(payment) => void state.confirmPayment(payment)}
      />
    </div>
  );
}
