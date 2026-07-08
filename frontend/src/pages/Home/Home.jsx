import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Search } from "lucide-react";

import { Button } from "../../components/ui";
import useAuth from "../../features/auth/useAuth";
import { getHomeSummary } from "../../features/tours/tourApi";
import "./Home.css";

const initialSummary = {
  date: "",
  booked_tours: [],
  no_show_tours: [],
  filters: {
    locations: [],
  },
};

function getTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatTourTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function TourList({ title, tours, tone }) {
  const navigate = useNavigate();
  const status = tone === "booked" ? "scheduled" : "no_show";
  const statusLabel = tone === "booked" ? "booked" : "no show";

  return (
    <article className={`home-card home-card--${tone}`}>
      <div className="home-card__header">
        <h2>{title}</h2>
        <button
          className="home-card__count"
          type="button"
          aria-label={`View today's ${statusLabel} tours`}
          onClick={() => navigate(`/tours?date=${getTodayValue()}&status=${status}`)}
        >
          {tours.length}
        </button>
      </div>

      <div className="home-tour-list">
        {tours.length > 0 ? (
          tours.map((tour) => (
            <div className="home-tour-row" key={tour.id}>
              <div className="home-tour-row__family">
                <strong>{tour.family_name}</strong>
                <span>Grade {tour.child_grade || "not set"}</span>
              </div>
              <div className="home-tour-row__meta">
                <span>{formatTourTime(tour.scheduled_tour_date)}</span>
                <span>{tour.location_name}</span>
              </div>
              <button
                className="home-tour-row__view"
                type="button"
                aria-label={`View ${tour.family_name} family tour details`}
                onClick={() => navigate(`/tours/${tour.id}`)}
              >
                <Eye aria-hidden="true" />
              </button>
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
    date: getTodayValue(),
    location: user?.role === "staff" && user.location ? String(user.location) : "",
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
          date: filters.date,
          location: filters.location || undefined,
          search: searchTerm || undefined,
        });

        if (isCurrent) {
          setSummary(data);
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

    loadSummary();

    return () => {
      isCurrent = false;
    };
  }, [filters.date, filters.location, searchTerm]);

  const selectedLocation = useMemo(
    () =>
      summary.filters.locations.find(
        (location) => String(location.id) === String(filters.location),
      ),
    [filters.location, summary.filters.locations],
  );

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  return (
    <section className="home-page" aria-label="Home dashboard">
      <div className="home-tools" aria-label="Tour filters">
        <div className="home-filter-grid">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter("date", event.target.value)}
            />
          </label>

          <label>
            <span>Location</span>
            <select
              value={filters.location}
              onChange={(event) => updateFilter("location", event.target.value)}
              disabled={user?.role === "staff"}
            >
              {user?.role !== "staff" && <option value="">All locations</option>}
              {summary.filters.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.location_name}
                </option>
              ))}
            </select>
          </label>

          <label className="home-search">
            <span>Search family</span>
            <Search className="home-search__icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search family names"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        {(filters.location || searchTerm) && (
          <div className="home-active-filters" aria-label="Active filters">
            {filters.location && (
              <button
                type="button"
                disabled={user?.role === "staff"}
                onClick={() => updateFilter("location", "")}
              >
                {selectedLocation?.location_name || "Location"}
                {user?.role !== "staff" && <span aria-hidden="true">x</span>}
              </button>
            )}
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm("")}>
                Family: {searchTerm}
                <span aria-hidden="true">x</span>
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="home-state home-state--error">{error}</p>}
      {isLoading && <p className="home-state">Loading tours...</p>}

      <div className="home-summary" aria-label="Today tour summary">
        <TourList
          title="Today's booked tours"
          tours={summary.booked_tours}
          tone="booked"
        />
        <TourList
          title="Today's no show"
          tours={summary.no_show_tours}
          tone="noshow"
        />
      </div>

      <div className="home-fixed-action">
        <Button size="lg" onClick={() => navigate("/tours/new")}>
          + New Tour
        </Button>
      </div>
    </section>
  );
}

export default Home;
