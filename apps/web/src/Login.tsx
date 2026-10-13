import { useState, type FormEvent } from "react";
import {
  Droplets,
  ShieldCheck,
  Building2,
  LockKeyhole,
  ArrowRight,
  CircleAlert,
} from "lucide-react";
import type { Session } from "./authTypes";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
type LoginMode = "tenant" | "platform";
export default function Login({
  onLogin,
}: {
  onLogin: (session: Session) => void;
}) {
  const [mode, setMode] = useState<LoginMode>(() =>
    window.location.pathname.startsWith("/platform") ? "platform" : "tenant",
  );
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${API}/api/web/v1/${mode === "platform" ? "platform-auth" : "auth"}/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "platform"
              ? { email, password }
              : { email, password, tenantSlug },
          ),
          credentials: "include",
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.error?.message ?? "Sign in failed.");
      onLogin(payload as Session);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to sign in. Check your API connection.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-orb orb-one" />
      <div className="auth-orb orb-two" />
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <Droplets size={23} />
          </div>
          <div>
            <strong>
              savvy<span>.</span>
            </strong>
            <small>OPERATIONS PLATFORM</small>
          </div>
        </div>
        <div className="auth-illustration">
          <div className="auth-illustration-icon">
            <ShieldCheck size={30} />
          </div>
          <div>
            <b>One platform. Every operation.</b>
            <span>Secure access to your workspace.</span>
          </div>
          <div className="auth-lines">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <p className="eyebrow">WELCOME BACK</p>
            <h1>Sign in to Savvy</h1>
            <p>Choose the account type you want to access.</p>
          </div>
          <div className="login-switch">
            <button
              className={mode === "tenant" ? "selected" : ""}
              onClick={() => {
                setMode("tenant");
                window.history.replaceState({}, "", "/login");
                setError("");
              }}
              type="button"
            >
              <Building2 size={15} /> Customer / Tenant
            </button>
            <button
              className={mode === "platform" ? "selected" : ""}
              onClick={() => {
                setMode("platform");
                window.history.replaceState({}, "", "/platform/login");
                setError("");
              }}
              type="button"
            >
              <ShieldCheck size={15} /> Super admin
            </button>
          </div>
          <form onSubmit={submit} className="login-form">
            {mode === "tenant" && (
              <label>
                Tenant workspace slug
                <div className="auth-input">
                  <Building2 size={16} />
                  <input
                    required
                    value={tenantSlug}
                    onChange={(e) =>
                      setTenantSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      )
                    }
                    placeholder="e.g. acme-operations"
                    autoComplete="organization"
                  />
                </div>
                <small>Provided when your workspace was created.</small>
              </label>
            )}
            <label>
              Email address
              <div className="auth-input">
                <span className="at-symbol">@</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="username"
                />
              </div>
            </label>
            <label>
              Password
              <div className="auth-input">
                <LockKeyhole size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
            </label>
            {error && (
              <div className="auth-error">
                <CircleAlert size={16} />
                {error}
              </div>
            )}
            <button className="auth-submit" disabled={busy}>
              {busy
                ? "Signing in…"
                : mode === "platform"
                  ? "Sign in to platform"
                  : "Sign in to workspace"}{" "}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-secure">
            <LockKeyhole size={13} /> Encrypted sign-in · Tenant-isolated
            workspace
          </div>
        </div>
      </div>
      <div className="auth-footer">
        © 2026 Savvy Operations <span>Secure multi-tenant access</span>
      </div>
    </div>
  );
}
