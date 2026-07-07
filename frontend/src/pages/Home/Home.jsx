import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import useAuth from "../../features/auth/useAuth";
import { getHomeSummary } from "../../features/tours/tourApi";
import { Button } from "../../components/ui";
import "./Home.css";

const initialSummary = {
  date: "",
  booked_tours: [],
  no_show_tours: [],
  filters: {
    locations: [],
    lead_sources: [],
    statuses: [],
  },
};

function getTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayLabel(dateValue) {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTourTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function applyStatusFilter(tours, status) {
  if (!status) {
    return tours;
  }
  return tours.filter((tour) => tour.current_status === status);
}

function TourList({ title, description, tours, tone }) {
  return (
    <article className={`home-card home-card--${tone}`}>
      <div className="home-card__header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="home-card__count">{tours.length}</span>
      </div>

      <div className="home-tour-list">
        {tours.length > 0 ? (
          tours.map((tour) => (
            <div className="home-tour-row" key={tour.id}>
              <div>
                <strong>{tour.family_name}</strong>
                <span>Grade {tour.child_grade || "not set"}</span>
              </div>
              <div className="home-tour-row__meta">
                <span>{formatTourTime(tour.scheduled_tour_date)}</span>
                <span>{tour.location_name}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="home-empty">No matching families found.</p>
        )}
      </div>
    </article>
  );
}

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    location: "",
    leadSource: "",
    status: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [summary, setSummary] = useState(initialSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadSummary() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getHomeSummary({
          date: getTodayValue(),
          location: filters.location || undefined,
          lead_source: filters.leadSource || undefined,
          search: searchTerm || undefined,
        });

        if (isCurrent) {
          setSummary(data);
        }
      } catch {
        if (isCurrent) {
          setError("Unable to load today's tours.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      isCurrent = false;
    };
  }, [filters.location, filters.leadSource, searchTerm]);

  const selectedFilters = Object.entries(filters).filter(([, value]) => value);
  const filteredBookedTours = useMemo(
    () => applyStatusFilter(summary.booked_tours, filters.status),
    [filters.status, summary.booked_tours],
  );
  const filteredNoShows = useMemo(
    () => applyStatusFilter(summary.no_show_tours, filters.status),
    [filters.status, summary.no_show_tours],
  );
  const filterLabels = useMemo(
    () => ({
      location:
        summary.filters.locations.find(
          (location) => String(location.id) === String(filters.location),
        )?.location_name || filters.location,
      leadSource:
        summary.filters.lead_sources.find(
          (source) => String(source.id) === String(filters.leadSource),
        )?.source_name || filters.leadSource,
      status:
        summary.filters.statuses.find((status) => status.value === filters.status)
          ?.label || filters.status,
    }),
    [filters, summary.filters],
  );
  const firstName = user?.first_name || user?.email?.split("@")[0] || "there";

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  function clearFilter(name) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: "",
    }));
  }

  return (
    <section className="home-page" aria-label="Home dashboard">
      <div className="home-hero">
        <div>
          <p className="home-hero__date">{getTodayLabel(summary.date)}</p>
          <h1>Hello {firstName}</h1>
        </div>
        <Button size="lg" onClick={() => navigate("/tours/new")}>
          New Tour
        </Button>
      </div>

      <div className="home-tools" aria-label="Tour filters">
        <label className="home-search">
          <span>Search family</span>
          <input
            type="search"
            placeholder="Search family names"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <div className="home-filter-grid">
          <label>
            <span>Location</span>
            <select
              value={filters.location}
              onChange={(event) => updateFilter("location", event.target.value)}
            >
              <option value="">All locations</option>
              {summary.filters.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.location_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Lead source</span>
            <select
              value={filters.leadSource}
              onChange={(event) =>
                updateFilter("leadSource", event.target.value)
              }
            >
              <option value="">All sources</option>
              {summary.filters.lead_sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.source_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">Booked and No Show</option>
              {summary.filters.statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(selectedFilters.length > 0 || searchTerm) && (
          <div className="home-active-filters" aria-label="Active filters">
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm("")}>
                Family: {searchTerm}
                <span aria-hidden="true">x</span>
              </button>
            )}
            {selectedFilters.map(([name, value]) => (
              <button
                type="button"
                key={name}
                onClick={() => clearFilter(name)}
              >
                {filterLabels[name] || value}
                <span aria-hidden="true">x</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="home-state home-state--error">{error}</p>}
      {isLoading && <p className="home-state">Loading tours...</p>}

      <div className="home-summary" aria-label="Today tour summary">
        <TourList
          title="Today's booked tours"
          description={`${summary.booked_tours.length} booked for today`}
          tours={filteredBookedTours}
          tone="booked"
        />
        <TourList
          title="Today's no show"
          description="No shows from yesterday's tours"
          tours={filteredNoShows}
          tone="noshow"
        />
      </div>
    </section>
  );
}

export default Home;
