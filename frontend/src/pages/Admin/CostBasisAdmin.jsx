import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  createCostBasis,
  listCostBasis,
  updateCostBasis,
} from "../../features/admin/costBasisApi";
import { listLocations } from "../../features/admin/locationApi";
import useAuth from "../../features/auth/useAuth";
import useUnsavedChangesPrompt from "../../hooks/useUnsavedChangesPrompt";
import { toTitleCaseWords } from "../../utils/textFormatting";
import "./Admin.css";

const emptyForm = {
  location: "",
  reporting_month: "",
  cost_type: "Expenditure",
  cost_amount: "",
  notes: "",
  is_active: true,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getErrorMessage(error) {
  const data = error.response?.data;
  if (!data || typeof data === "string") {
    if (error.response?.status === 404) return "The cost basis service is not available. Restart the backend and try again.";
    if (error.response?.status >= 500) return "The cost basis service encountered an error. Please try again.";
    return "Unable to complete the request.";
  }
  if (data.detail) return data.detail;
  const firstValue = Object.values(data)[0];
  return Array.isArray(firstValue) ? firstValue[0] : String(firstValue);
}

function toForm(entry) {
  return {
    location: String(entry.location),
    reporting_month: entry.reporting_month.slice(0, 7),
    cost_type: entry.cost_type,
    cost_amount: String(entry.cost_amount),
    notes: entry.notes || "",
    is_active: entry.is_active,
  };
}

function formatMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function CostBasisAdmin() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [entries, setEntries] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const canManageCostBasis = user?.role === "super_admin";
  const routeMode = location.pathname === "/admin/cost-basis/new"
    ? "new"
    : location.pathname.endsWith("/edit")
      ? params.id
      : null;
  const isDirty = useMemo(
    () => isFormOpen && JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm, isFormOpen],
  );

  useUnsavedChangesPrompt(isDirty && !isSaving);

  const loadData = useCallback(async () => {
    setError("");
    const [entryResult, locationResult] = await Promise.allSettled([
      listCostBasis(),
      listLocations({ include_inactive: true }),
    ]);
    if (entryResult.status === "fulfilled") setEntries(entryResult.value);
    if (locationResult.status === "fulfilled") setLocations(locationResult.value);
    const failedResult = [entryResult, locationResult]
      .find((result) => result.status === "rejected");
    if (failedResult) setError(getErrorMessage(failedResult.reason));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!canManageCostBasis) return;
    queueMicrotask(loadData);
  }, [canManageCostBasis, loadData]);

  useEffect(() => {
    if (!canManageCostBasis) return;
    queueMicrotask(() => {
      if (routeMode === "new") {
        setEditingId(null);
        setForm(emptyForm);
        setInitialForm(emptyForm);
        setIsFormOpen(true);
        return;
      }
      if (routeMode) {
        const selected = entries.find((entry) => String(entry.id) === routeMode);
        if (selected && editingId !== selected.id) {
          const nextForm = toForm(selected);
          setEditingId(selected.id);
          setForm(nextForm);
          setInitialForm(nextForm);
          setIsFormOpen(true);
        }
        return;
      }
      setIsFormOpen(false);
      setEditingId(null);
    });
  }, [canManageCostBasis, editingId, entries, routeMode]);

  if (!canManageCostBasis) return <Navigate to="/admin/locations" replace />;

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    navigate("/admin/cost-basis/new");
  }

  function openEditForm(entry) {
    navigate(`/admin/cost-basis/${entry.id}/edit`);
  }

  function closeForm() {
    if (isDirty && !window.confirm("You have unsaved changes. Close this form?")) return;
    navigate("/admin/cost-basis");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const payload = {
      ...form,
      location: Number(form.location),
      reporting_month: `${form.reporting_month}-01`,
      cost_amount: Number(form.cost_amount),
      notes: form.notes.trim(),
    };
    try {
      if (editingId) await updateCostBasis(editingId, payload);
      else await createCostBasis(payload);
      navigate("/admin/cost-basis", { replace: true });
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(entry) {
    setError("");
    try {
      await updateCostBasis(entry.id, { is_active: !entry.is_active });
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <section className="admin-page">
      <nav className="admin-tabs" aria-label="Admin sections">
        <NavLink to="/admin/users">Users</NavLink>
        <NavLink to="/admin/locations">Locations</NavLink>
        <NavLink to="/admin/lead-sources">Lead Sources</NavLink>
        <NavLink to="/admin/cost-basis">Cost Basis</NavLink>
      </nav>

      <header className="admin-heading">
        <div><h2>Manage cost basis</h2><p>{entries.length} entries</p></div>
        <button type="button" onClick={openCreateForm}>Add cost/revenue</button>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}

      {isFormOpen && (
        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <h3>{editingId ? "Edit cost/revenue" : "Add cost/revenue"}</h3>
            <button type="button" onClick={closeForm}>Cancel</button>
          </div>
          <label htmlFor="cost-location">Location</label>
          <select id="cost-location" value={form.location} onChange={(event) => updateForm("location", event.target.value)} required>
            <option value="">Select location</option>
            {locations.map((item) => <option key={item.id} value={item.id}>{toTitleCaseWords(item.location_name)}</option>)}
          </select>
          <label htmlFor="cost-month">Reporting month</label>
          <input id="cost-month" type="month" value={form.reporting_month} onChange={(event) => updateForm("reporting_month", event.target.value)} required />
          <label htmlFor="cost-type">Type</label>
          <select id="cost-type" value={form.cost_type} onChange={(event) => updateForm("cost_type", event.target.value)} required>
            <option value="Expenditure">Expenditure</option>
            <option value="Revenue">Revenue</option>
          </select>
          <label htmlFor="cost-amount">Amount (USD)</label>
          <input id="cost-amount" type="number" min="0" step="0.01" value={form.cost_amount} onChange={(event) => updateForm("cost_amount", event.target.value)} required />
          <label htmlFor="cost-notes">Notes</label>
          <textarea id="cost-notes" rows="3" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
          <label className="admin-checkbox" htmlFor="cost-active">
            <input id="cost-active" type="checkbox" checked={form.is_active} onChange={(event) => updateForm("is_active", event.target.checked)} />
            <span>Entry is active</span>
          </label>
          <button className="primary-action" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save cost/revenue"}</button>
        </form>
      )}

      <div className="user-list">
        {isLoading && <p className="empty-state">Loading cost basis...</p>}
        {!isLoading && entries.map((entry) => (
          <article className="user-row" key={entry.id}>
            <div className="user-summary">
              <strong>{toTitleCaseWords(entry.location_name)} · {entry.cost_type}</strong>
              <span>{formatMonth(entry.reporting_month)} · {currencyFormatter.format(Number(entry.cost_amount))}</span>
              {entry.notes && <span>{entry.notes}</span>}
            </div>
            <div className="user-status-actions">
              <span className={entry.is_active ? "status-active" : "status-inactive"}>{entry.is_active ? "Active" : "Inactive"}</span>
              <button className="admin-row-action admin-row-action--edit" type="button" onClick={() => openEditForm(entry)}>Edit</button>
              <button className={`admin-row-action ${entry.is_active ? "admin-row-action--deactivate" : "admin-row-action--reactivate"}`} type="button" onClick={() => handleStatusChange(entry)}>
                {entry.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default CostBasisAdmin;
