import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

type InvitationDetails = {
  managerName: string;
  email: string;
  plantName: string;
  tenantName: string;
  tenantSlug: string;
  expiresAt: string;
  existingAccount: boolean;
};

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const INVITATION_API = `${API_URL}/api/web/v1/auth/plant-manager-invitations`;

type ApiError = { error?: { message?: string } };

export default function AcceptPlantManagerInvitation() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    message: string;
    tenantSlug: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setError(
          "The invitation link is missing its token. Ask your tenant administrator to send a new invitation.",
        );
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${INVITATION_API}/${encodeURIComponent(token)}`,
        );
        const body = (await response.json()) as {
          data?: InvitationDetails;
        } & ApiError;
        if (!response.ok)
          throw new Error(
            body.error?.message ?? "Could not load this invitation.",
          );
        if (!cancelled) setInvitation(body.data ?? null);
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load this invitation.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInvitation();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation || submitting) return;

    if (!invitation.existingAccount) {
      if (password.length < 12) {
        setError("Choose a password with at least 12 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(
        `${INVITATION_API}/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invitation.existingAccount ? {} : { password }),
        },
      );
      const body = (await response.json()) as {
        data?: { tenantSlug: string; email: string };
        message?: string;
      } & ApiError;
      if (!response.ok || !body.data)
        throw new Error(
          body.error?.message ?? "Could not accept this invitation.",
        );
      setSuccess({
        message: body.message ?? "Invitation accepted.",
        tenantSlug: body.data.tenantSlug,
        email: body.data.email,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not accept this invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#f4f6fb",
    color: "#182033",
    fontFamily: "Inter, system-ui, sans-serif",
  };
  const cardStyle: CSSProperties = {
    width: "100%",
    maxWidth: 500,
    boxSizing: "border-box",
    background: "#fff",
    border: "1px solid #e2e7f0",
    borderRadius: 18,
    padding: 30,
    boxShadow: "0 18px 60px rgba(22, 38, 74, 0.08)",
  };
  const fieldStyle: CSSProperties = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    marginTop: 7,
    padding: "12px 13px",
    borderRadius: 9,
    border: "1px solid #ccd5e4",
    fontSize: 15,
  };
  const buttonStyle: CSSProperties = {
    width: "100%",
    marginTop: 18,
    border: 0,
    borderRadius: 9,
    padding: "13px 16px",
    background: "#243b73",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div
          style={{
            color: "#526aa7",
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: 1.6,
          }}
        >
          SAVVY WORKSPACE
        </div>
        <h1 style={{ margin: "10px 0 6px", fontSize: 28 }}>
          Plant Manager invitation
        </h1>
        {loading ? <p>Checking your invitation…</p> : null}
        {!loading && error && !success ? (
          <p
            role="alert"
            style={{
              padding: 12,
              color: "#9d2424",
              background: "#fff0f0",
              borderRadius: 8,
            }}
          >
            {error}
          </p>
        ) : null}
        {!loading && invitation && !success ? (
          <>
            <p style={{ color: "#566176", lineHeight: 1.6 }}>
              Hello <strong>{invitation.managerName}</strong>. You have been
              invited to manage <strong>{invitation.plantName}</strong> for{" "}
              <strong>{invitation.tenantName}</strong>.
            </p>
            <div
              style={{
                background: "#f6f8fc",
                padding: 14,
                borderRadius: 10,
                margin: "18px 0",
              }}
            >
              <div>
                <strong>Email:</strong> {invitation.email}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Workspace slug:</strong> {invitation.tenantSlug}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: "#68748a" }}>
                Expires: {new Date(invitation.expiresAt).toLocaleString()}
              </div>
            </div>
            {invitation.existingAccount ? (
              <p style={{ lineHeight: 1.6, color: "#566176" }}>
                This email already has a Savvy account. Accepting this
                invitation will add the Plant Manager role to this workspace;
                your existing password will not change.
              </p>
            ) : (
              <p style={{ lineHeight: 1.6, color: "#566176" }}>
                Create a password to finish setting up your Plant Manager
                account. Use at least 12 characters.
              </p>
            )}
            <form onSubmit={submit}>
              {!invitation.existingAccount ? (
                <>
                  <label
                    style={{ display: "block", marginTop: 16, fontWeight: 650 }}
                  >
                    Password
                    <input
                      style={fieldStyle}
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={72}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  <label
                    style={{ display: "block", marginTop: 16, fontWeight: 650 }}
                  >
                    Confirm password
                    <input
                      style={fieldStyle}
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={72}
                      required
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                    />
                  </label>
                </>
              ) : null}
              {error ? (
                <p role="alert" style={{ color: "#9d2424" }}>
                  {error}
                </p>
              ) : null}
              <button style={buttonStyle} type="submit" disabled={submitting}>
                {submitting ? "Accepting invitation…" : "Accept invitation"}
              </button>
            </form>
          </>
        ) : null}
        {success ? (
          <div>
            <p
              role="status"
              style={{
                padding: 12,
                color: "#1c6b43",
                background: "#eaf8f0",
                borderRadius: 8,
              }}
            >
              {success.message}
            </p>
            <p>
              <strong>Email:</strong> {success.email}
            </p>
            <p>
              <strong>Workspace slug:</strong> {success.tenantSlug}
            </p>
            <p>
              Go to login and sign in with this workspace slug and your account
              credentials.
            </p>
            <a
              href="/login"
              style={{
                ...buttonStyle,
                display: "block",
                boxSizing: "border-box",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Go to login
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
