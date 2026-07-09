import { useEffect, useMemo, useState } from "react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import useAuth from "../../features/auth/useAuth";
import {
  createDefaultTourFilters,
  getDateRange,
  joinFilterValues,
} from "../../features/tours/filterConfig";
import { getLeadSources, getLocations, listTours } from "../../features/tours/tourApi";
import "./Analytics.css";

const metricLabels = {
  scheduled: "Booked",
  toured: "Toured",
  enrolled: "Enrolled",
  churned: "Churned",
  no_show: "No Show",
};

function Analytics() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(() => createDefaultTourFilters(user));
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [tours, setTours] = useState([]);
  const [costBasis, setCostBasis] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadOptions() {
      try {
        const [locationData, sourceData] = await Promise.all([
          getLocations(),
          getLeadSources(),
        ]);
        if (isCurrent) {
          setLocations(locationData);
          setLeadSources(sourceData);
          if (user?.role === "staff" && user.location) {
            setFilters((currentFilters) => ({
              ...currentFilters,
              locations: [String(user.location)],
            }));
          }
        }
      } catch {
        if (isCurrent) {
          setError("Unable to load filter options.");
        }
      }
    }

    loadOptions();

    return () => {
      isCurrent = false;
    };
  }, [user]);

  useEffect(() => {
    let isCurrent = true;

    async function loadTours() {
      setIsLoading(true);
      setError("");
      const dateRange = getDateRange(filters);

      try {
        const tourData = await listTours({
          date_from: dateRange.dateFrom || undefined,
          date_to: dateRange.dateTo || undefined,
          location: joinFilterValues(filters.locations),
          lead_source: joinFilterValues(filters.leadSources),
          status: joinFilterValues(filters.statuses),
        });

        if (isCurrent) {
          setTours(Array.isArray(tourData) ? tourData : tourData.results || []);
        }
      } catch {
        if (isCurrent) {
          setError("Unable to load analytics.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadTours();

    return () => {
      isCurrent = false;
    };
  }, [filters]);

  const metrics = useMemo(() => {
    const counts = tours.reduce(
      (summary, tour) => ({
        ...summary,
        [tour.current_status]: (summary[tour.current_status] || 0) + 1,
      }),
      {},
    );
    return Object.entries(metricLabels).map(([status, label]) => ({
        label,
        value: counts[status] || 0,
        tone: status,
      }));
  }, [tours]);

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  return (
    <section className="analytics-page" aria-label="Analytics">
      <TourFilterControls
        filters={filters}
        leadSources={leadSources}
        locations={locations}
        onChange={updateFilter}
        showCostBasis
        showSearch={false}
        showStatus={false}
        costBasis={costBasis}
        onCostBasisChange={setCostBasis}
        staffLocationOnly={user?.role === "staff"}
      />

      {error && <p className="analytics-state analytics-state--error">{error}</p>}
      {isLoading && <p className="analytics-state">Loading analytics...</p>}

      <div className="analytics-grid" aria-label="Analytics summary">
        {metrics.map((metric) => (
          <article className={`analytics-card analytics-card--${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Analytics;
