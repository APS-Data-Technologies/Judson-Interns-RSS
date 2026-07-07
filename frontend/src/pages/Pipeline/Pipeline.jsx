import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Filter,
  GraduationCap,
  MapPin,
  Search,
  UserRoundCheck,
  UserRoundX,
  X,
} from "lucide-react";

import heroImage from "../../assets/login/Desktop_Hero.png";
import { getLocations, listTours } from "../../features/tours/tourApi";
import "./Pipeline.css";

const pipelineStatuses = [
  { value: "scheduled", label: "Booked", icon: CalendarCheck },
  { value: "toured", label: "Toured", icon: UserRoundCheck },
  { value: "enrolled", label: "Enrolled", icon: GraduationCap },
  { value: "churned", label: "Churned", icon: UserRoundX },
  { value: "no_show", label: "No Show", icon: X },
];

function formatTourDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function PipelineCard({ tour }) {
  const navigate = useNavigate();
  const status = pipelineStatuses.find((item) => item.value === tour.current_status);

  return (
    <article className="pipeline-card">
      <div className="pipeline-card__content">
        <div>
          <h3>{tour.family_name} Family</h3>
          <p>
            Grade {tour.child_grade || "not set"} <span aria-hidden="true">·</span>{" "}
            {tour.location_name}
          </p>
          <p>Tour Date: {formatTourDate(tour.scheduled_tour_date)}</p>
        </div>
        <span className={`pipeline-card__badge pipeline-card__badge--${tour.current_status}`}>
          {status?.label || tour.status_label}
        </span>
      </div>
      <div className="pipeline-card__actions">
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

function Pipeline() {
  const [tours, setTours] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    location: "",
    search: "",
  });
  const [openSections, setOpenSections] = useState(["toured"]);
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
          search: filters.search || undefined,
        });

        if (isCurrent) {
          setTours(Array.isArray(tourData) ? tourData : tourData.results || []);
        }
      } catch {
        if (isCurrent) {
          setError("Unable to load pipeline.");
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

  const groupedTours = useMemo(
    () =>
      pipelineStatuses.reduce((groups, status) => {
        groups[status.value] = tours.filter(
          (tour) => tour.current_status === status.value,
        );
        return groups;
      }, {}),
    [tours],
  );

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  function toggleSection(status) {
    setOpenSections((currentSections) =>
      currentSections.includes(status)
        ? currentSections.filter((item) => item !== status)
        : [...currentSections, status],
    );
  }

  return (
    <section className="pipeline-page" aria-label="Pipeline">
      <header className="pipeline-hero">
        <img src={heroImage} alt="" aria-hidden="true" />
        <h1>Pipeline</h1>
      </header>

      <div className="pipeline-controls" aria-label="Pipeline filters">
        <label>
          <Filter aria-hidden="true" />
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">All Status</option>
            {pipelineStatuses.map((status) => (
              <option key={status.value} value={status.value}>
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
          <select aria-label="Date filter" disabled>
            <option>All Dates</option>
          </select>
        </label>

        <label className="pipeline-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Search tours..."
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </label>
      </div>

      {error && <p className="pipeline-state pipeline-state--error">{error}</p>}
      {isLoading && <p className="pipeline-state">Loading pipeline...</p>}

      <div className="pipeline-groups">
        {pipelineStatuses.map((status) => {
          const Icon = status.icon;
          const groupTours = groupedTours[status.value] || [];
          const isOpen = openSections.includes(status.value);

          return (
            <section
              className={`pipeline-group pipeline-group--${status.value}`}
              key={status.value}
            >
              <button
                className="pipeline-group__header"
                type="button"
                onClick={() => toggleSection(status.value)}
                aria-expanded={isOpen}
              >
                <span className="pipeline-group__icon">
                  <Icon aria-hidden="true" />
                </span>
                <strong>{status.label}</strong>
                <span className="pipeline-group__count">{groupTours.length}</span>
                {isOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </button>

              {isOpen && (
                <div className="pipeline-group__body">
                  {groupTours.length > 0 ? (
                    groupTours.slice(0, 6).map((tour) => (
                      <PipelineCard key={tour.id} tour={tour} />
                    ))
                  ) : (
                    <p className="pipeline-empty">No tours in this status.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default Pipeline;
