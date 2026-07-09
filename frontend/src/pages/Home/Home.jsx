import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import { Button } from "../../components/ui";
import useAuth from "../../features/auth/useAuth";
import {
  createDefaultTourFilters,
  getDateRange,
  todayValue,
} from "../../features/tours/filterConfig";
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
          onClick={() => navigate(`/tours?date=${todayValue()}&status=${status}`)}
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
  const [filters, setFilters] = useState(() => createDefaultTourFilters(user));
  const [summary, setSummary] = useState(initialSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadSummary() {
      setIsLoading(true);
      setError("");
      const dateRange = getDateRange(filters);

      try {
        const data = await getHomeSummary({
          date_from: dateRange.dateFrom || undefined,
          date_to: dateRange.dateTo || undefined,
          location: filters.locations[0] || undefined,
          search: filters.search || undefined,
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
  }, [filters]);

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  return (
    <section className="home-page" aria-label="Home dashboard">
      <div className="home-tools" aria-label="Tour filters">
        <TourFilterControls
          filters={filters}
          leadSources={[]}
          locations={summary.filters.locations}
          onChange={updateFilter}
          searchPlaceholder="Search family names"
          showLeadSource={false}
          showStatus={false}
          staffLocationOnly={user?.role === "staff"}
        />
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
