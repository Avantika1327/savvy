import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Plant, PlantInput } from "../../../types/plant";

export type PlantFormValues = {
  name: string;
  address: string;
  manager: string;
  location: string;
  pincode: string;
  details: string;
};

const EMPTY_FORM: PlantFormValues = {
  name: "",
  address: "",
  manager: "",
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
    location: plant.location ?? "",
    pincode: plant.pincode ?? "",
    details: plant.details ?? "",
  };
}

function toPayload(values: PlantFormValues): PlantInput {
  const cleanOptional = (value: string): string | null => value.trim() || null;
  return {
    name: values.name.trim(),
    address: cleanOptional(values.address),
    manager: cleanOptional(values.manager),
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

export default function PlantFormModal({ plant, saving, error, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<PlantFormValues>(() => getInitialValues(plant));
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setValues(getInitialValues(plant));
    setValidationError("");
  }, [plant]);

  function update<K extends keyof PlantFormValues>(field: K, value: PlantFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (values.name.trim().length < 2) {
      setValidationError("Plant name must contain at least 2 characters.");
      return;
    }
    setValidationError("");
    await onSubmit(toPayload(values));
  }

  return (
    <div className="plant-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="plant-modal" role="dialog" aria-modal="true" aria-labelledby="plant-modal-title">
        <header className="plant-modal-heading">
          <div>
            <span className="plant-eyebrow">PLANT MANAGEMENT</span>
            <h2 id="plant-modal-title">{plant ? "Edit plant" : "Create plant"}</h2>
            <p>{plant ? "Update this plant's information." : "Add a plant to your tenant workspace."}</p>
          </div>
          <button type="button" className="plant-close-button" onClick={onClose} disabled={saving} aria-label="Close form"><X size={18} /></button>
        </header>

        {(validationError || error) && <div className="plant-inline-error" role="alert">{validationError || error}</div>}

        <form onSubmit={submit}>
          <div className="plant-form-grid">
            <label className="plant-field plant-field-full">
              <span>Plant name *</span>
              <input required minLength={2} maxLength={120} value={values.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Pune Plant" autoFocus />
            </label>
            <label className="plant-field">
              <span>Manager</span>
              <input maxLength={120} value={values.manager} onChange={(e) => update("manager", e.target.value)} placeholder="Plant manager name" />
            </label>
            <label className="plant-field">
              <span>Location / city</span>
              <input maxLength={120} value={values.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Pune" />
            </label>
            <label className="plant-field plant-field-full">
              <span>Address</span>
              <input maxLength={250} value={values.address} onChange={(e) => update("address", e.target.value)} placeholder="Street, area, city" />
            </label>
            <label className="plant-field">
              <span>Pincode</span>
              <input maxLength={20} value={values.pincode} onChange={(e) => update("pincode", e.target.value)} placeholder="Postal code" />
            </label>
            <label className="plant-field plant-field-full">
              <span>Notes</span>
              <textarea maxLength={2000} rows={3} value={values.details} onChange={(e) => update("details", e.target.value)} placeholder="Additional plant details" />
            </label>
          </div>

          <footer className="plant-modal-actions">
            <button className="plant-btn plant-btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="plant-btn plant-btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : plant ? "Save changes" : "Create plant"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
