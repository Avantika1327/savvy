import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { Session } from "./authTypes";
import { clearStoredSession, readStoredSession, storeSession } from "./auth/session";
import Login from "./Login";
import PlatformTenants from "./PlatformTenants";
import TenantDashboard from "./pages/TenantDashboard";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectFrom = (location.state as { from?: unknown } | null)?.from;
  const [session, setSession] = useState<Session | null>(() => readStoredSession());

  const handleLogin = useCallback((value: Session) => {
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
    const destination = safeSession.user.platformRole === "SUPER_ADMIN"
      ? requestedPlatformPath ?? "/platform-admin"
      : "/workspace";

    navigate(destination, { replace: true });
  }, [navigate, redirectFrom]);

  const logout = useCallback(() => {
    const isPlatformAdmin = session?.user.platformRole === "SUPER_ADMIN";
    const route = isPlatformAdmin
      ? "/api/web/v1/platform-auth/logout"
      : "/api/web/v1/auth/logout";
    const api = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

    void (async () => {
      try {
        await fetch(`${api}${route}`, { method: "POST", credentials: "include" });
      } catch {
        // Always clear local state even when the API is temporarily unavailable.
      } finally {
        clearStoredSession();
        setSession(null);
        navigate(isPlatformAdmin ? "/platform-admin/login" : "/login", { replace: true });
      }
    })();
  }, [navigate, session?.user.platformRole]);

  if (!session) {
    return (
      <Routes>
        <Route path="/platform-admin/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route
          path="/platform-admin/*"
          element={<Navigate to="/platform-admin/login" replace state={{ from: location.pathname }} />}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (session.user.platformRole === "SUPER_ADMIN") {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/platform-admin" replace />} />
        <Route path="/platform-admin/login" element={<Navigate to="/platform-admin" replace />} />
        <Route path="/platform-admin/*" element={<PlatformTenants session={session} onLogout={logout} />} />
        <Route path="*" element={<Navigate to="/platform-admin" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/workspace" replace />} />
      <Route path="/platform-admin/*" element={<Navigate to="/workspace" replace />} />
      <Route
        path="/workspace"
        element={
          <TenantDashboard
            onLogout={logout}
            tenantName={session.tenant?.name ?? "Your workspace"}
            userName={session.user.name ?? "Tenant account"}
          />
        }
      />
      <Route path="*" element={<Navigate to="/workspace" replace />} />
    </Routes>
  );
}


