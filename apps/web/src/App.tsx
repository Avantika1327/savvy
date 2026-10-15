import { useCallback, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type { Session } from "./authTypes";
import {
  clearStoredSession,
  readStoredSession,
  storeSession,
} from "./auth/session";
import Login from "./Login";
import PlatformTenants from "./PlatformTenants";
import TenantDashboard from "./pages/TenantDashboard";
import PlantsPage from "./pages/PlantsPage";
import WorkspaceDashboardPage from "./pages/WorkspaceDashboardPage";
import WorkspaceModulePage from "./pages/WorkspaceModulePage";
import AcceptPlantManagerInvitation from "./pages/AcceptPlantManagerInvitation";
import {
  canAccessWorkspaceItem,
  resolveWorkspaceRole,
  workspaceItems,
} from "./data/dashboardData";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectFrom = (location.state as { from?: unknown } | null)?.from;
  const [session, setSession] = useState<Session | null>(() =>
    readStoredSession(),
  );

  const handleLogin = useCallback(
    (value: Session) => {
      // Persist only safe display metadata; never persist access tokens.
      const safeSession = storeSession(value);
      if (!safeSession) {
        setSession(null);
        navigate("/login", { replace: true });
        return;
      }

      setSession(safeSession);
      const requestedPlatformPath =
        typeof redirectFrom === "string" &&
        redirectFrom.startsWith("/platform-admin/") &&
        redirectFrom !== "/platform-admin/login"
          ? redirectFrom
          : null;
      const requestedWorkspacePath =
        typeof redirectFrom === "string" &&
        (redirectFrom === "/workspace" ||
          redirectFrom.startsWith("/workspace/"))
          ? redirectFrom
          : null;

      const destination =
        safeSession.user.platformRole === "SUPER_ADMIN"
          ? (requestedPlatformPath ?? "/platform-admin")
          : (requestedWorkspacePath ?? "/workspace");

      navigate(destination, { replace: true });
    },
    [navigate, redirectFrom],
  );

  const logout = useCallback(() => {
    const isPlatformAdmin = session?.user.platformRole === "SUPER_ADMIN";
    const route = isPlatformAdmin
      ? "/api/web/v1/platform-auth/logout"
      : "/api/web/v1/auth/logout";
    const api = (
      import.meta.env.VITE_API_URL ?? "http://localhost:4000"
    ).replace(/\/+$/, "");

    void (async () => {
      try {
        await fetch(`${api}${route}`, {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // Always clear local state even when the API is temporarily unavailable.
      } finally {
        clearStoredSession();
        setSession(null);
        navigate(isPlatformAdmin ? "/platform-admin/login" : "/login", {
          replace: true,
        });
      }
    })();
  }, [navigate, session?.user.platformRole]);

  if (!session) {
    return (
      <Routes>
        <Route
          path="/platform-admin/login"
          element={<Login onLogin={handleLogin} />}
        />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        {/* Public route: invite acceptance must work before the manager has a session. */}
        <Route
          path="/accept-plant-invitation"
          element={<AcceptPlantManagerInvitation />}
        />
        <Route
          path="/platform-admin/*"
          element={
            <Navigate
              to="/platform-admin/login"
              replace
              state={{ from: location.pathname }}
            />
          }
        />
        <Route
          path="/workspace/*"
          element={
            <Navigate to="/login" replace state={{ from: location.pathname }} />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (session.user.platformRole === "SUPER_ADMIN") {
    return (
      <Routes>
        <Route
          path="/login"
          element={<Navigate to="/platform-admin" replace />}
        />
        <Route
          path="/platform-admin/login"
          element={<Navigate to="/platform-admin" replace />}
        />
        <Route
          path="/platform-admin/*"
          element={<PlatformTenants session={session} onLogout={logout} />}
        />
        <Route
          path="/accept-plant-invitation"
          element={<AcceptPlantManagerInvitation />}
        />
        <Route path="*" element={<Navigate to="/platform-admin" replace />} />
      </Routes>
    );
  }

  const workspaceRole = resolveWorkspaceRole(
    session.user.role,
    session.user.tenantRole,
  );
  const normalizedTenantRole = (session.user.tenantRole ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const canManagePlants = ["TENANT_OWNER", "TENANT_ADMIN", "MANAGER"].includes(
    normalizedTenantRole,
  );
  const plantsItem = workspaceItems.find((item) => item.key === "plants");

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/workspace" replace />} />
      <Route
        path="/platform-admin/*"
        element={<Navigate to="/workspace" replace />}
      />
      <Route
        path="/accept-plant-invitation"
        element={<AcceptPlantManagerInvitation />}
      />
      <Route
        path="/workspace"
        element={
          <TenantDashboard
            onLogout={logout}
            tenantName={session.tenant?.name ?? "Your workspace"}
            userName={session.user.name ?? "Tenant account"}
            workspaceRole={workspaceRole}
          />
        }
      >
        <Route index element={<WorkspaceDashboardPage />} />
        {workspaceItems
          .filter((item) => item.route !== "")
          .map((item) => {
            const allowed = canAccessWorkspaceItem(item, workspaceRole);
            const element = !allowed ? (
              <Navigate to="/workspace" replace />
            ) : item.key === "plants" ? (
              <PlantsPage canManagePlants={canManagePlants} />
            ) : (
              <WorkspaceModulePage item={item} />
            );

            return <Route key={item.key} path={item.route} element={element} />;
          })}
        {/* Backward-compatible alias for the earlier /workspace/plants URL. */}
        <Route
          path="plants"
          element={
            plantsItem && canAccessWorkspaceItem(plantsItem, workspaceRole) ? (
              <Navigate to="/workspace/plant" replace />
            ) : (
              <Navigate to="/workspace" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/workspace" replace />} />
    </Routes>
  );
}
