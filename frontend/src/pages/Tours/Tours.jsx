import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Filter, MapPin, Search } from "lucide-react";

import heroImage from "../../assets/login/Desktop_Hero.png";
import { getLocations, listTours } from "../../features/tours/tourApi";
import "./Tours.css";

const statusOptions = [
  { value: "", label: "All" },
  { value: "scheduled", label: "Booked" },
  { value: "toured", label: "Toured" },
  { value: "no_show", label: "No Show" },
  { value: "enrolled", label: "Enrolled" },
  { value: "churned", label: "Churned" },
  { value: "cancelled", label: "Cancelled" },
];

const statusLabels = {
  scheduled: "Booked",
  rescheduled: "Rescheduled",
  toured: "Toured",
  enrolled: "Enrolled",
  churned: "Churned",
  cancelled: "Cancelled",
  no_show: "No Show",
};

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

  return (
    <article className="tour-card">
      <div className="tour-card__content">
        <div>
          <h2>{tour.family_name} Family</h2>
          <p>
            Grade {tour.child_grade || "not set"} <span aria-hidden="true">·</span>{" "}
            {tour.location_name}
          </p>
          <p>Tour Date: {formatTourDate(tour.scheduled_tour_date)}</p>
        </div>
        <span className={`tour-status tour-status--${tour.current_status}`}>
          {statusLabel}
        </span>
      </div>

      <div className="tour-card__actions">
        <button type="button" onClick={() => navigate(`/tours/${tour.id}`)}>
          View Details
        </button>
        <button type="button" onClick={() => navigate(`/tours/${tour.id}/edit`)}>
          Edit Tour
        </button>
      </div>
    </article>
  );
}

function Tours() {
  const [tours, setTours] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    location: "",
    date: todayValue(),
    search: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadOptions() {
      try {
        const locationData = await getLocations();
        if (isCurrent) {
          setLocations(locationData);
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
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadTours() {
      setIsLoading(true);
      setError("");

      try {
        const tourData = await listTours({
          status: filters.status || undefined,
          location: filters.location || undefined,
          date: filters.date || undefined,
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

  const selectedLocation = useMemo(
    () =>
      locations.find((location) => String(location.id) === String(filters.location)),
    [filters.location, locations],
  );

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  return (
    <section className="tours-page" aria-label="Tours list">
      <header className="tours-hero">
        <img src={heroImage} alt="" aria-hidden="true" />
        <h1>Tours</h1>
      </header>

      <div className="tours-controls" aria-label="Tour filters">
        <label>
          <Filter aria-hidden="true" />
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status.value || "all"} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <MapPin aria-hidden="true" />
          <span>Location</span>
          <select
            value={filters.location}
            onChange={(event) => updateFilter("location", event.target.value)}
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.location_name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <CalendarDays aria-hidden="true" />
          <span>Date</span>
          <input
            type="date"
            value={filters.date}
            onChange={(event) => updateFilter("date", event.target.value)}
          />
        </label>

        <label className="tours-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Search tours..."
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </label>
      </div>

      <div className="tours-context">
        <span>{statusOptions.find((status) => status.value === filters.status)?.label || "All"} status</span>
        <span>{selectedLocation?.location_name || "All locations"}</span>
        <span>{filters.date ? formatTourDate(`${filters.date}T00:00:00`) : "All dates"}</span>
      </div>

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
