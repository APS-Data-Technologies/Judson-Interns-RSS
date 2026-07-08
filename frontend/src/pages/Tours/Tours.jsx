import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, Pencil } from "lucide-react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import useAuth from "../../features/auth/useAuth";
import {
  currentMonthValue,
  currentYearValue,
  getDateRange,
  joinFilterValues,
  statusLabels,
} from "../../features/tours/filterConfig";
import { getLeadSources, getLocations, listTours } from "../../features/tours/tourApi";
import "./Tours.css";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatTourDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function TourCard({ tour }) {
  const navigate = useNavigate();
  const statusLabel = statusLabels[tour.current_status] || tour.status_label;
  const familyName = tour.family_name.endsWith("Family")
    ? tour.family_name
    : `${tour.family_name} Family`;

  return (
    <article className="tour-card">
      <div className="tour-card__content">
        <div>
          <h2>{familyName}</h2>
          <p>
            Grade {tour.child_grade || "not set"} <span aria-hidden="true">·</span>{" "}
            {tour.location_name}
          </p>
          <p>Tour Date: {formatTourDate(tour.scheduled_tour_date)}</p>
        </div>
        <div className="tour-card__side">
          <span className={`tour-status status-color--${tour.current_status}`}>
            {statusLabel}
          </span>
          <div className="tour-card__actions" aria-label={`${familyName} actions`}>
            <button
              type="button"
              aria-label={`View ${familyName} details`}
              onClick={() => navigate(`/tours/${tour.id}`)}
            >
              <Eye aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Edit ${familyName}`}
              onClick={() => navigate(`/tours/${tour.id}/edit`)}
            >
              <Pencil aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Tours() {
  const location = useLocation();
  const { user } = useAuth();
  const queryFilters = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get("date") || "";
    const datePreset = dateParam && dateParam !== todayValue() ? "custom" : "today";
    return {
      datePreset,
      dateFrom: dateParam && datePreset === "custom" ? dateParam : "",
      dateTo: dateParam && datePreset === "custom" ? dateParam : "",
      statuses: params.get("status")?.split(",").filter(Boolean) || [],
    };
  }, [location.search]);
  const [tours, setTours] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [filters, setFilters] = useState({
    datePreset: queryFilters.datePreset,
    dateFrom: queryFilters.dateFrom,
    dateTo: queryFilters.dateTo,
    month: currentMonthValue(),
    year: currentYearValue(),
    locations: user?.role === "staff" && user.location ? [String(user.location)] : [],
    leadSources: [],
    statuses: queryFilters.statuses,
    search: "",
  });
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
          status: joinFilterValues(filters.statuses),
          location: joinFilterValues(filters.locations),
          lead_source: joinFilterValues(filters.leadSources),
          date_from: dateRange.dateFrom || undefined,
          date_to: dateRange.dateTo || undefined,
          search: filters.search || undefined,
        });

        if (isCurrent) {
          setTours(Array.isArray(tourData) ? tourData : tourData.results || []);
        }
      } catch {
        if (isCurrent) {
          setError("Unable to load tours.");
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

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  return (
    <section className="tours-page" aria-label="Tours list">
      <TourFilterControls
        filters={filters}
        leadSources={leadSources}
        locations={locations}
        onChange={updateFilter}
        searchPlaceholder="Search family name"
        staffLocationOnly={user?.role === "staff"}
      />

      {error && <p className="tours-state tours-state--error">{error}</p>}
      {isLoading && <p className="tours-state">Loading tours...</p>}

      <div className="tours-list">
        {!isLoading && tours.length === 0 && (
          <p className="tours-state">No tours match these filters.</p>
        )}
        {tours.map((tour) => (
          <TourCard key={tour.id} tour={tour} />
        ))}
      </div>
    </section>
  );
}

export default Tours;
