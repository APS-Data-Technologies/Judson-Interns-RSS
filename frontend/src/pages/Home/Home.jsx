import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import { Button } from "../../components/ui";
import useAuth from "../../features/auth/useAuth";
import {
  createDefaultTourFilters,
  todayValue,
} from "../../features/tours/filterConfig";
import { getHomeSummary } from "../../features/tours/tourApi";
import { toTitleCaseWords } from "../../utils/displayText";
import "./Home.css";

const initialSummary = {
  date: "",
  booked_tours: [],
  no_show_tours: [],
  filters: {
    locations: [],
  },
};

function formatTourDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function yesterdayValue() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortToursByTime(tours) {
  return [...tours].sort((firstTour, secondTour) => (
    new Date(firstTour.scheduled_tour_date).getTime() -
    new Date(secondTour.scheduled_tour_date).getTime()
  ));
}

function TourList({ title, tours, tone }) {
  const navigate = useNavigate();
  const status = tone === "booked" ? "scheduled" : "no_show";
  const statusLabel = tone === "booked" ? "booked" : "no show";
  const filterDate = tone === "booked" ? todayValue() : yesterdayValue();

  return (
    <article className={`home-card home-card--${tone}`}>
      <div className="home-card__header">
        <h2>{title}</h2>
        <button
          className="home-card__count"
          type="button"
          aria-label={`View ${statusLabel} tours`}
          onClick={() => navigate(`/tours?date=${filterDate}&status=${status}`)}
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
                <span>{toTitleCaseWords(tour.location_name)}</span>
              </div>
              <div className="home-tour-row__meta">
                <span>{formatTourDateTime(tour.scheduled_tour_date)}</span>
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
  const [filters, setFilters] = useState(() =>
    createDefaultTourFilters(user, { datePreset: "today" }),
  );
  const [summary, setSummary] = useState(initialSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const bookedTours = useMemo(
    () => sortToursByTime(summary.booked_tours),
    [summary.booked_tours],
  );
  const noShowTours = useMemo(
    () => sortToursByTime(summary.no_show_tours),
    [summary.no_show_tours],
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadSummary() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getHomeSummary({
          date: todayValue(),
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
          lockDate
          searchPlaceholder="Search family names"
          showLeadSource={false}
          showStatus={false}
          staffLocationLabel={user?.location_name}
          staffLocationOnly={user?.role === "staff"}
        />
      </div>

      {error && <p className="home-state home-state--error">{error}</p>}
      {isLoading && <p className="home-state">Loading tours...</p>}

      <div className="home-summary" aria-label="Today tour summary">
        <TourList
          title="Today's Booked Tours"
          tours={bookedTours}
          tone="booked"
        />
        <TourList
          title="Yesterday's No Shows"
          tours={noShowTours}
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
