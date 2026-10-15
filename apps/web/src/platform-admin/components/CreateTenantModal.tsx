import { Check, KeyRound, Plus, ShieldCheck, X } from "lucide-react";
import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { configurableRoles, createDefaultRolePermissions, tenantModules } from "../constants";
import type { ConfigurableMembershipRole, PermissionAction, RolePermissionSetting, TenantForm, TenantModule } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  form: TenantForm;
  setForm: Dispatch<SetStateAction<TenantForm>>;
  saving: boolean;
};

export default function CreateTenantModal({ open, onClose, onSubmit, form, setForm, saving }: Props) {
  const [activeRole, setActiveRole] = useState<ConfigurableMembershipRole>("TENANT_ADMIN");

  const updateModuleEnabled = (module: TenantModule, enabled: boolean) => {
    setForm((current) => ({
      ...current,
      enabledModules: enabled
        ? Array.from(new Set([...current.enabledModules, module]))
        : current.enabledModules.filter((item) => item !== module),
      // Keep the user's permission choices when toggling a module off and back on.
      rolePermissions: current.rolePermissions.length
        ? current.rolePermissions
        : createDefaultRolePermissions(),
    }));
  };

  const updatePermission = (module: TenantModule, action: PermissionAction, checked: boolean) => {
    setForm((current) => {
      const existing = current.rolePermissions.length
        ? current.rolePermissions
        : createDefaultRolePermissions();
      const target = existing.find((item) => item.role === activeRole && item.module === module);
      const base: RolePermissionSetting = target ?? {
        role: activeRole,
        module,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      };
      const next: RolePermissionSetting = { ...base, [action]: checked };

      // Write permissions require read access. Removing read access removes all write permissions.
      if (action === "canView" && !checked) {
        next.canCreate = false;
        next.canEdit = false;
        next.canDelete = false;
      } else if (action !== "canView" && checked) {
        next.canView = true;
      }

      return {
        ...current,
        rolePermissions: [
          ...existing.filter((item) => !(item.role === activeRole && item.module === module)),
          next,
        ],
      };
    });
  };

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
                  <section className="workspace-access-section" aria-labelledby="workspace-modules-heading">
                    <div className="workspace-access-heading">
                      <div className="workspace-access-heading-icon"><KeyRound size={18} /></div>
                      <div>
                        <h3 id="workspace-modules-heading">Workspace modules</h3>
                        <p>Choose which operational modules this customer can use.</p>
                      </div>
                    </div>
                    <div className="workspace-module-grid">
                      {tenantModules.map((module) => {
                        const checked = form.enabledModules.includes(module.value);
                        return (
                          <label className={`workspace-module-option ${checked ? "is-enabled" : ""}`} key={module.value}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => updateModuleEnabled(module.value, event.target.checked)}
                            />
                            <span className="workspace-module-check"><Check size={13} /></span>
                            <span className="workspace-module-copy">
                              <strong>{module.label}</strong>
                              <small>{module.description}</small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="workspace-access-help">
                      Disabled modules must also be blocked by the API; hiding a menu item is not a security control.
                    </p>
                  </section>

                  <section className="workspace-access-section" aria-labelledby="workspace-permissions-heading">
                    <div className="workspace-access-heading">
                      <div className="workspace-access-heading-icon"><ShieldCheck size={18} /></div>
                      <div>
                        <h3 id="workspace-permissions-heading">Default role permissions</h3>
                        <p>Set permissions for users added to this workspace. The Tenant Owner always has full access to enabled modules.</p>
                      </div>
                    </div>
                    <div className="role-permission-tabs" role="tablist" aria-label="Select a role">
                      {configurableRoles.map((role) => (
                        <button
                          key={role.value}
                          type="button"
                          role="tab"
                          aria-selected={activeRole === role.value}
                          className={activeRole === role.value ? "active" : ""}
                          onClick={() => setActiveRole(role.value)}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                    <p className="role-permission-description">
                      {configurableRoles.find((role) => role.value === activeRole)?.description}
                    </p>
                    <div className="role-permission-matrix">
                      <div className="role-permission-row role-permission-header">
                        <span>Module</span>
                        <span>View</span>
                        <span>Create</span>
                        <span>Edit</span>
                        <span>Delete</span>
                      </div>
                      {tenantModules.map((module) => {
                        const moduleEnabled = form.enabledModules.includes(module.value);
                        const permission = form.rolePermissions.find((item) => item.role === activeRole && item.module === module.value)
                          ?? createDefaultRolePermissions([module.value]).find((item) => item.role === activeRole)!;
                        const actions: { key: PermissionAction; label: string }[] = [
                          { key: "canView", label: `Allow ${module.label} view` },
                          { key: "canCreate", label: `Allow ${module.label} create` },
                          { key: "canEdit", label: `Allow ${module.label} edit` },
                          { key: "canDelete", label: `Allow ${module.label} delete` },
                        ];
                        return (
                          <div className={`role-permission-row ${!moduleEnabled ? "is-disabled" : ""}`} key={module.value}>
                            <span className="role-permission-module">{module.label}{!moduleEnabled && <small>Module disabled</small>}</span>
                            {actions.map(({ key, label }) => (
                              <label className="permission-checkbox" key={key} aria-label={label} title={label}>
                                <input
                                  type="checkbox"
                                  checked={permission[key]}
                                  disabled={!moduleEnabled || (key !== "canView" && !permission.canView)}
                                  onChange={(event) => updatePermission(module.value, key, event.target.checked)}
                                />
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </section>

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
