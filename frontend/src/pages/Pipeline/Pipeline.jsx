import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  GraduationCap,
  Pencil,
  UserRoundCheck,
  UserRoundX,
  X,
} from "lucide-react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import useAuth from "../../features/auth/useAuth";
import {
  currentMonthValue,
  currentYearValue,
  getDateRange,
  joinFilterValues,
} from "../../features/tours/filterConfig";
import { getLeadSources, getLocations, listTours } from "../../features/tours/tourApi";
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
  const familyName = tour.family_name.endsWith("Family")
    ? tour.family_name
    : `${tour.family_name} Family`;

  return (
    <article className="pipeline-card">
      <div className="pipeline-card__content">
        <div>
          <h3>{familyName}</h3>
          <p>
            Grade {tour.child_grade || "not set"} <span aria-hidden="true">·</span>{" "}
            {tour.location_name}
          </p>
          <p>Tour Date: {formatTourDate(tour.scheduled_tour_date)}</p>
        </div>
        <div className="pipeline-card__side">
          <span className={`pipeline-card__badge status-color--${tour.current_status}`}>
            {status?.label || tour.status_label}
          </span>
          <div className="pipeline-card__actions" aria-label={`${familyName} actions`}>
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

function Pipeline() {
  const { user } = useAuth();
  const [tours, setTours] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [filters, setFilters] = useState({
    datePreset: "last_30_days",
    dateFrom: "",
    dateTo: "",
    month: currentMonthValue(),
    year: currentYearValue(),
    locations: user?.role === "staff" && user.location ? [String(user.location)] : [],
    leadSources: [],
    statuses: [],
    search: "",
  });
  const [openSections, setOpenSections] = useState(["toured"]);
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
      <div className="pipeline-controls" aria-label="Pipeline filters">
        <TourFilterControls
          filters={filters}
          leadSources={leadSources}
          locations={locations}
          onChange={updateFilter}
          searchPlaceholder="Search family name"
          staffLocationOnly={user?.role === "staff"}
        />
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
