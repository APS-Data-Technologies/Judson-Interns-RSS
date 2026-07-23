import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Clock3, Database, ShieldCheck, TriangleAlert } from "lucide-react";
import { NavLink } from "react-router-dom";
import useAuth from "../../features/auth/useAuth";
import {
  getAnalyticsEngineStatus,
  validateAnalyticsEngine,
} from "../../features/analytics/analyticsEngineApi";
import "./AnalyticsEngineAdmin.css";

function formatDateTime(value) {
  if (!value) return "No records yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminNavigation({ isSuperAdmin }) {
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {isSuperAdmin && <NavLink to="/admin/users">Users</NavLink>}
      <NavLink to="/admin/locations">Locations</NavLink>
      <NavLink to="/admin/lead-sources">Lead Sources</NavLink>
      {isSuperAdmin && <NavLink to="/admin/cost-basis">Cost Basis</NavLink>}
    </nav>
  );
}

function AnalyticsEngineAdmin() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const isSuperAdmin = user.role === "super_admin";

  useEffect(() => {
    let cancelled = false;
    getAnalyticsEngineStatus()
      .then((status) => {
        if (!cancelled) setData(status);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.response?.data?.detail || "Unable to load analytics engine status.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleValidate() {
    setIsValidating(true);
    setError("");
    try {
      setData(await validateAnalyticsEngine());
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to validate the analytics engine.");
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <section className="admin-page analytics-engine-admin">
      <AdminNavigation isSuperAdmin={isSuperAdmin} />

      <header className="engine-hero">
        <div>
          <span className="engine-eyebrow">ANALYTICS GOVERNANCE</span>
          <h2>Analytics Engine</h2>
          <p>Health, business definitions, access, and operational safeguards in one place.</p>
        </div>
        {isSuperAdmin && (
          <button disabled={isLoading || isValidating} onClick={handleValidate} type="button">
            {isValidating ? "Validating…" : "Validate now"}
          </button>
        )}
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {isLoading && <p className="empty-state">Loading analytics engine status…</p>}

      {data && (
        <>
          <div className="engine-status-strip">
            <div>
              {data.health.status === "healthy"
                ? <CheckCircle2 aria-hidden="true" />
                : <TriangleAlert aria-hidden="true" />}
              <span><small>System health</small><strong>{data.health.status}</strong></span>
            </div>
            <div>
              <Activity aria-hidden="true" />
              <span><small>Calculation mode</small><strong>Live operational data</strong></span>
            </div>
            <div>
              <Clock3 aria-hidden="true" />
              <span><small>Latest source change</small><strong>{formatDateTime(data.health.latestSourceChange)}</strong></span>
            </div>
          </div>

          <section className="engine-panel">
            <div className="engine-panel__heading">
              <Database aria-hidden="true" />
              <div><h3>Data freshness and loading</h3><p>Analytics recalculates from current records when a page or filter changes.</p></div>
            </div>
            <div className="engine-source-grid">
              {data.health.sources.map((source) => (
                <article key={source.name}>
                  <span>{source.name}</span>
                  <strong>{source.records.toLocaleString()}</strong>
                  <small>Latest change: {formatDateTime(source.latestChange)}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="engine-panel">
            <div className="engine-panel__heading">
              <ShieldCheck aria-hidden="true" />
              <div><h3>Metric definitions</h3><p>Approved business rules used consistently across analytics pages and exports.</p></div>
            </div>
            <div className="engine-definition-grid">
              {data.metricGroups.map((group) => (
                <article key={group.name}>
                  <h4>{group.name}</h4>
                  <ul>{group.definitions.map((definition) => <li key={definition}>{definition}</li>)}</ul>
                </article>
              ))}
            </div>
          </section>

          <section className="engine-panel">
            <div className="engine-panel__heading">
              <ShieldCheck aria-hidden="true" />
              <div><h3>Access and permissions</h3><p>Displayed results and drill-through data follow the signed-in user’s scope.</p></div>
            </div>
            <div className="engine-table-wrap">
              <table className="engine-table">
                <thead><tr><th>Role</th><th>Analytics scope</th><th>Financials</th><th>Engine status</th></tr></thead>
                <tbody>
                  {data.access.map((row) => (
                    <tr key={row.role}>
                      <th>{row.role}</th><td>{row.scope}</td>
                      <td>{row.financials ? "Allowed" : "Restricted"}</td>
                      <td>{row.engineAdmin ? "Allowed" : "Restricted"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="engine-panel engine-retention">
            <div>
              <span className="engine-policy-status">{data.retention.status}</span>
              <h3>Retention and purge</h3>
              <p>{data.retention.message}</p>
              <small>{data.retention.backupMessage}</small>
            </div>
            <button disabled type="button">Purge unavailable</button>
          </section>

          <section className="engine-panel">
            <div className="engine-panel__heading">
              <Clock3 aria-hidden="true" />
              <div><h3>Validation and export history</h3><p>Recent engine checks and analytics exports.</p></div>
            </div>
            {data.operations.length === 0 ? (
              <p className="engine-empty">No recorded operations yet.</p>
            ) : (
              <div className="engine-operation-list">
                {data.operations.map((operation) => (
                  <article key={operation.id}>
                    <span className={`engine-operation-status is-${operation.status}`}>{operation.status}</span>
                    <div><strong>{operation.type}</strong><p>{operation.detail}</p></div>
                    <small>{operation.initiatedBy}<br />{formatDateTime(operation.createdAt)}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default AnalyticsEngineAdmin;
