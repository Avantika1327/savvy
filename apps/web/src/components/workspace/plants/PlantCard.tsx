import {
  CalendarDays,
  Globe2,
  Mail,
  MapPin,
  Pencil,
  Power,
  UserRound,
} from "lucide-react";
import type { Plant } from "../../../types/plant";
import { sanitizeRichTextHtml } from "../../../utils/richText";

type Props = {
  plant: Plant;
  busy: boolean;
  canManage: boolean;
  onEdit: (plant: Plant) => void;
  onToggleActive: (plant: Plant) => void;
};

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export default function PlantCard({
  plant,
  busy,
  canManage,
  onEdit,
  onToggleActive,
}: Props) {
  return (
    <article className="plant-card">
      <div className="plant-card-head">
        <div className="plant-card-symbol" aria-hidden="true">
          {plant.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="plant-card-title">
          <h3>{plant.name}</h3>
          <span
            className={`plant-state ${plant.isActive ? "is-active" : "is-inactive"}`}
          >
            <i /> {plant.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        {canManage && (
          <button
            className="plant-icon-action"
            type="button"
            onClick={() => onEdit(plant)}
            aria-label={`Edit ${plant.name}`}
            title="Edit plant"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      <div className="plant-card-info">
        <div>
          <MapPin size={15} />
          <span>
            {[plant.location, plant.address, plant.pincode]
              .filter(Boolean)
              .join(" · ") || "No location details added"}
          </span>
        </div>
        <div>
          <UserRound size={15} />
          <span>{plant.manager || "Manager not assigned"}</span>
        </div>
        {plant.managerEmail && (
          <div>
            <Mail size={15} />
            <span>{plant.managerEmail}</span>
          </div>
        )}
        <div>
          <Globe2 size={15} />
          <span>
            {plant.coverageType === "PAN_INDIA" ? "Pan India" : "Local"}{" "}
            coverage
          </span>
        </div>
        <div>
          <CalendarDays size={15} />
          <span>Added {formatCreatedAt(plant.createdAt)}</span>
        </div>
      </div>

      {plant.details && (
        <div
          className="plant-card-details plant-card-rich-details"
          dangerouslySetInnerHTML={{
            __html: sanitizeRichTextHtml(plant.details),
          }}
        />
      )}

      {canManage && (
        <div className="plant-card-footer">
          <button
            className={`plant-toggle-action ${plant.isActive ? "deactivate" : "activate"}`}
            type="button"
            disabled={busy}
            onClick={() => onToggleActive(plant)}
          >
            <Power size={15} />
            {busy
              ? "Updating…"
              : plant.isActive
                ? "Deactivate plant"
                : "Activate plant"}
          </button>
        </div>
      )}
    </article>
  );
}
