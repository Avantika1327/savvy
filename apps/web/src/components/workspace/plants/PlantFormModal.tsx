import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type {
  Plant,
  PlantInput,
  PlantCoverageType,
} from "../../../types/plant";
import RichTextEditor from "./RichTextEditor";

export type PlantFormValues = {
  name: string;
  address: string;
  manager: string;
  managerEmail: string;
  coverageType: PlantCoverageType;
  location: string;
  pincode: string;
  details: string;
};

const EMPTY_FORM: PlantFormValues = {
  name: "",
  address: "",
  manager: "",
  managerEmail: "",
  coverageType: "LOCAL",
  location: "",
  pincode: "",
  details: "",
};

function getInitialValues(plant: Plant | null): PlantFormValues {
  if (!plant) return EMPTY_FORM;
  return {
    name: plant.name,
    address: plant.address ?? "",
    manager: plant.manager ?? "",
    managerEmail: plant.managerEmail ?? "",
    coverageType: plant.coverageType ?? "LOCAL",
    location: plant.location ?? "",
    pincode: plant.pincode ?? "",
    details: plant.details ?? "",
  };
}

function cleanOptional(value: string): string | null {
  return value.trim() || null;
}

function toPayload(values: PlantFormValues): PlantInput {
  return {
    name: values.name.trim(),
    address: cleanOptional(values.address),
    manager: cleanOptional(values.manager),
    managerEmail: cleanOptional(values.managerEmail)?.toLowerCase() ?? null,
    coverageType: values.coverageType,
    location: cleanOptional(values.location),
    pincode: cleanOptional(values.pincode),
    details: cleanOptional(values.details),
  };
}

type Props = {
  plant: Plant | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (payload: PlantInput) => Promise<void>;
};

export default function PlantFormModal({
  plant,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<PlantFormValues>(() =>
    getInitialValues(plant),
  );
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setValues(getInitialValues(plant));
    setValidationError("");
  }, [plant]);

  function update<K extends keyof PlantFormValues>(
    field: K,
    value: PlantFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = values.name.trim();
    if (normalizedName.length < 2) {
      setValidationError("Plant name must contain at least 2 characters.");
      return;
    }

    const email = values.managerEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError("Enter a valid manager email address.");
      return;
    }

    const pincode = values.pincode.trim();
    if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
      setValidationError("Enter a valid 6-digit Indian PIN code.");
      return;
    }

    setValidationError("");
    await onSubmit(toPayload(values));
  }

  return (
    <div
      className="plant-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="plant-modal plant-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plant-modal-title"
      >
        <header className="plant-modal-heading">
          <div>
            <span className="plant-eyebrow">PLANT MANAGEMENT</span>
            <h2 id="plant-modal-title">
              {plant ? "Edit Plants" : "Create Plants"}
            </h2>
            <p>
              {plant
                ? "Update plant information and coverage."
                : "Enter the plant's details to add it to this workspace."}
            </p>
          </div>
          <button
            type="button"
            className="plant-close-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
          >
            <X size={18} />
          </button>
        </header>

        {(validationError || error) && (
          <div className="plant-inline-error" role="alert">
            {validationError || error}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <div className="plant-form-grid plant-form-grid-screenshot">
            <label className="plant-field plant-field-third">
              <span>Name *</span>
              <input
                required
                minLength={2}
                maxLength={120}
                value={values.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Enter the plant name"
                autoFocus
                disabled={saving}
                autoComplete="organization"
              />
            </label>

            <label className="plant-field plant-field-third">
              <span>Manager</span>
              <input
                maxLength={120}
                value={values.manager}
                onChange={(event) => update("manager", event.target.value)}
                placeholder="Enter the manager's name"
                disabled={saving}
                autoComplete="name"
              />
            </label>

            <label className="plant-field plant-field-third">
              <span>Manager Email</span>
              <input
                type="email"
                maxLength={254}
                value={values.managerEmail}
                onChange={(event) => update("managerEmail", event.target.value)}
                placeholder="Enter the email"
                disabled={saving}
                autoComplete="email"
              />
            </label>

            <fieldset className="plant-coverage-options plant-field-full">
              <legend className="sr-only">Plant coverage</legend>
              <label>
                <input
                  type="radio"
                  name="plant-coverage"
                  value="LOCAL"
                  checked={values.coverageType === "LOCAL"}
                  onChange={() => update("coverageType", "LOCAL")}
                  disabled={saving}
                />
                <span>Local</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="plant-coverage"
                  value="PAN_INDIA"
                  checked={values.coverageType === "PAN_INDIA"}
                  onChange={() => update("coverageType", "PAN_INDIA")}
                  disabled={saving}
                />
                <span>Pan India</span>
              </label>
            </fieldset>

            <label className="plant-field plant-field-half">
              <span>Address</span>
              <input
                maxLength={250}
                value={values.address}
                onChange={(event) => update("address", event.target.value)}
                placeholder="Enter the address"
                disabled={saving}
                autoComplete="street-address"
              />
            </label>

            <label className="plant-field plant-field-half">
              <span>Location</span>
              <input
                maxLength={120}
                value={values.location}
                onChange={(event) => update("location", event.target.value)}
                placeholder="Enter the location"
                disabled={saving}
                autoComplete="address-level2"
              />
            </label>

            <label className="plant-field plant-field-half">
              <span>Pin Code</span>
              <input
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                value={values.pincode}
                onChange={(event) =>
                  update(
                    "pincode",
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                placeholder="Enter the pin code"
                disabled={saving}
              />
            </label>

            <div className="plant-field plant-field-full">
              <span>Details</span>
              <RichTextEditor
                value={values.details}
                onChange={(html) => update("details", html)}
                disabled={saving}
                label="Plant details"
              />
              <small className="plant-field-help">
                Basic formatting is supported. Unsafe HTML is removed before
                display and must also be sanitized by the API.
              </small>
            </div>
          </div>

          <footer className="plant-modal-actions">
            <button
              className="plant-btn plant-btn-secondary"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="plant-btn plant-btn-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : plant ? "Save" : "Save"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
