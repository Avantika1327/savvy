import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Factory, Plus, RefreshCw, Search } from "lucide-react";
import PlantCard from "../components/workspace/plants/PlantCard";
import PlantFormModal from "../components/workspace/plants/PlantFormModal";
import { plantsApi } from "../services/plantsApi";
import type { Plant, PlantInput, PlantStatusFilter } from "../types/plant";
import "./plants.css";

type Props = { canManagePlants: boolean };

export default function PlantsPage({ canManagePlants }: Props) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyPlantId, setBusyPlantId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlantStatusFilter>("ALL");
  const [formPlant, setFormPlant] = useState<Plant | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPlants = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      setPlants(await plantsApi.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load plants.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlants(); }, [loadPlants]);

  const activeCount = plants.filter((plant) => plant.isActive).length;
  const inactiveCount = plants.length - activeCount;
  const filteredPlants = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plants.filter((plant) => {
      const matchesSearch = !query || [plant.name, plant.manager, plant.managerEmail, plant.location, plant.address, plant.pincode, plant.details]
        .some((value) => (value ?? "").toLowerCase().includes(query));
      const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? plant.isActive : !plant.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [plants, search, statusFilter]);

  function openCreate() {
    setFormPlant(null);
    setError("");
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(plant: Plant) {
    setFormPlant(plant);
    setError("");
    setFormError("");
    setFormOpen(true);
  }

  async function savePlant(input: PlantInput) {
    setSaving(true);
    setError("");
    setFormError("");
    setNotice("");
    try {
      if (formPlant) {
        await plantsApi.update(formPlant.id, input);
        setNotice(`${input.name} updated successfully.`);
      } else {
        await plantsApi.create(input);
        setNotice(`${input.name} created successfully.`);
      }
      setFormOpen(false);
      setFormPlant(null);
      await loadPlants(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not save the plant.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePlant(plant: Plant) {
    const nextActive = !plant.isActive;
    const action = nextActive ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${plant.name}?`)) return;

    setBusyPlantId(plant.id);
    setError("");
    setNotice("");
    try {
      await plantsApi.setActive(plant.id, nextActive);
      setNotice(`${plant.name} ${nextActive ? "activated" : "deactivated"} successfully.`);
      await loadPlants(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${action} the plant.`);
    } finally {
      setBusyPlantId(null);
    }
  }

  return (
    <section className="plants-page">
      <header className="plants-page-heading">
        <div>
          <span className="plant-eyebrow"><span className="plant-live-dot" /> WORKSPACE MANAGEMENT</span>
          <h1>Plants</h1>
          <p>Manage plant locations, assign managers, and control plant availability.</p>
        </div>
        <div className="plants-heading-actions">
          <button className="plant-btn plant-btn-secondary" type="button" onClick={() => void loadPlants()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "plant-spin" : ""} /> Refresh
          </button>
          {canManagePlants && (
            <button className="plant-btn plant-btn-primary" type="button" onClick={openCreate}>
              <Plus size={16} /> Add plant
            </button>
          )}
        </div>
      </header>

      <div className="plants-summary-grid">
        <div className="plants-summary-card"><span className="plants-summary-icon"><Factory size={18} /></span><div><small>Total plants</small><strong>{loading ? "—" : plants.length}</strong></div></div>
        <div className="plants-summary-card"><span className="plants-summary-icon plants-summary-icon-active"><CheckCircle2 size={18} /></span><div><small>Active plants</small><strong>{loading ? "—" : activeCount}</strong></div></div>
        <div className="plants-summary-card"><span className="plants-summary-icon plants-summary-icon-inactive"><PowerIcon /></span><div><small>Inactive plants</small><strong>{loading ? "—" : inactiveCount}</strong></div></div>
      </div>

      {(error || notice) && <div className={`plants-alert ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>
        {error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
        <span>{error || notice}</span>
        <button type="button" onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss message">×</button>
      </div>}

      <div className="plants-toolbar">
        <label className="plants-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plants, manager, location…" /></label>
        <div className="plants-filters" role="group" aria-label="Filter plants by status">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => <button key={filter} type="button" className={statusFilter === filter ? "selected" : ""} onClick={() => setStatusFilter(filter)}>{filter === "ALL" ? "All plants" : filter === "ACTIVE" ? "Active" : "Inactive"}</button>)}
        </div>
        <span className="plants-result-count">{filteredPlants.length} result{filteredPlants.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className="plants-page-state"><span className="plants-loader" />Loading plants…</div>
      ) : filteredPlants.length === 0 ? (
        <div className="plants-page-state"><span className="plants-empty-icon"><Factory size={24} /></span><h3>{plants.length === 0 ? "No plants created yet" : "No matching plants"}</h3><p>{plants.length === 0 ? (canManagePlants ? "Create your first plant to start managing operations by location." : "No plants have been added to this workspace yet.") : "Try changing your search or status filter."}</p>{plants.length === 0 && canManagePlants && <button className="plant-btn plant-btn-primary" type="button" onClick={openCreate}><Plus size={16} /> Create first plant</button>}</div>
      ) : (
        <div className="plants-card-grid">{filteredPlants.map((plant) => <PlantCard key={plant.id} plant={plant} busy={busyPlantId === plant.id} canManage={canManagePlants} onEdit={openEdit} onToggleActive={(value) => void togglePlant(value)} />)}</div>
      )}

      <footer className="plants-page-footer">Plant changes apply only to your current tenant workspace.</footer>

      {formOpen && <PlantFormModal plant={formPlant} saving={saving} error={formError} onClose={() => { if (!saving) { setFormOpen(false); setFormPlant(null); setFormError(""); } }} onSubmit={savePlant} />}
    </section>
  );
}

function PowerIcon() {
  return <span aria-hidden="true" className="plants-power-glyph">⏻</span>;
}
