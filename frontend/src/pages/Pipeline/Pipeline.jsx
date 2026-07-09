import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
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
  createDefaultTourFilters,
  getDateRange,
  joinFilterValues,
} from "../../features/tours/filterConfig";
import {
  getLeadSources,
  getLocations,
  listTours,
  transitionTourStatus,
} from "../../features/tours/tourApi";
import "./Pipeline.css";

const pipelineStatuses = [
  { value: "scheduled", label: "Booked", icon: CalendarCheck },
  { value: "toured", label: "Toured", icon: UserRoundCheck },
  { value: "enrolled", label: "Enrolled", icon: GraduationCap },
  { value: "churned", label: "Churned", icon: UserRoundX },
  { value: "no_show", label: "No Show", icon: X },
];

const nextStageActions = {
  scheduled: [
    { value: "toured", label: "Toured" },
    { value: "no_show", label: "No Show" },
  ],
  toured: [
    { value: "enrolled", label: "Enrolled" },
    { value: "churned", label: "Churned" },
  ],
};

function formatTourDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function PipelineCard({ tour, onMove, isMoving }) {
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
      {nextStageActions[tour.current_status]?.length > 0 && (
        <div className="pipeline-card__moves" aria-label={`Move ${familyName}`}>
          {nextStageActions[tour.current_status].map((action) => (
            <button
              type="button"
              key={action.value}
              disabled={isMoving}
              onClick={() => onMove(tour.id, action.value)}
            >
              {isMoving ? "Moving" : action.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function Pipeline() {
  const { user } = useAuth();
  const [tours, setTours] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [filters, setFilters] = useState(() => createDefaultTourFilters(user));
  const [activeStatus, setActiveStatus] = useState("scheduled");
  const [movingTourId, setMovingTourId] = useState(null);
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
  const activeStage = pipelineStatuses.find((status) => status.value === activeStatus) || pipelineStatuses[0];
  const activeTours = groupedTours[activeStage.value] || [];

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  async function moveTour(tourId, status) {
    setMovingTourId(tourId);
    setError("");

    try {
      const updatedTour = await transitionTourStatus(tourId, {
        status,
        notes: `Moved to ${status} from pipeline.`,
      });
      setTours((currentTours) =>
        currentTours.map((tour) => (tour.id === tourId ? updatedTour : tour)),
      );
    } catch {
      setError("Unable to move tour to the selected stage.");
    } finally {
      setMovingTourId(null);
    }
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
          showStatus={false}
          staffLocationOnly={user?.role === "staff"}
        />
      </div>

      {error && <p className="pipeline-state pipeline-state--error">{error}</p>}
      {isLoading && <p className="pipeline-state">Loading pipeline...</p>}

      <div className="pipeline-board">
        <div className="pipeline-tabs" role="tablist" aria-label="Pipeline stages">
        {pipelineStatuses.map((status) => {
          const Icon = status.icon;
          const groupTours = groupedTours[status.value] || [];

          return (
            <button
              className={`pipeline-tab pipeline-tab--${status.value}`}
              key={status.value}
              type="button"
              role="tab"
              aria-selected={activeStage.value === status.value}
              onClick={() => setActiveStatus(status.value)}
            >
              <span className="pipeline-tab__icon"><Icon aria-hidden="true" /></span>
              <span className="pipeline-tab__label">{status.label}</span>
              <span className="pipeline-tab__count">{groupTours.length}</span>
            </button>
          );
        })}
        </div>

        <section
          className={`pipeline-stage-panel pipeline-stage-panel--${activeStage.value}`}
          role="tabpanel"
          aria-label={`${activeStage.label} tours`}
        >
          <header className="pipeline-stage-panel__header">
            <div>
              <h2>{activeStage.label}</h2>
              <p>{activeTours.length} tours</p>
            </div>
            <span className="pipeline-stage-panel__count">{activeTours.length}</span>
          </header>

          <div className="pipeline-stage-panel__body">
            {activeTours.length > 0 ? (
              activeTours.map((tour) => (
                <PipelineCard
                  key={tour.id}
                  tour={tour}
                  isMoving={movingTourId === tour.id}
                  onMove={moveTour}
                />
              ))
            ) : (
              <p className="pipeline-empty">No tours in this status.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default Pipeline;
