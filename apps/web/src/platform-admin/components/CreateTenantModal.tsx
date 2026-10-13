import { Plus, ShieldCheck, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { TenantForm } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  form: TenantForm;
  setForm: Dispatch<SetStateAction<TenantForm>>;
  saving: boolean;
};

export default function CreateTenantModal({ open, onClose, onSubmit, form, setForm, saving }: Props) {
  if (!open) return null;
  return (
            <div
              className="modal-backdrop"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
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
                    onClick={() => onClose()}
                  >
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={onSubmit}>
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
                      onClick={() => onClose()}
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
  );
}
