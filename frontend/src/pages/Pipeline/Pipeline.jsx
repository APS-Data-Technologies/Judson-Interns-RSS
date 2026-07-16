import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarCheck,
  Check,
  Columns3,
  Eye,
  GraduationCap,
  ListChecks,
  MoveRight,
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
import {
  filterToursByTrackCategory,
  getTourTrackInfo,
  loadAverageDaysToEnroll,
} from "../../features/tours/tourTrackUtils";
import { toTitleCaseWords } from "../../utils/displayText";
import "./Pipeline.css";

const pipelineStatuses = [
  { value: "scheduled", label: "Booked", icon: CalendarCheck },
  { value: "toured", label: "Toured", icon: UserRoundCheck },
  { value: "no_show", label: "No Show", icon: X },
  { value: "enrolled", label: "Enrolled", icon: GraduationCap },
  { value: "churned", label: "Churned", icon: UserRoundX },
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

function formatTourDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sortToursByTime(tours, direction) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...tours].sort((firstTour, secondTour) => (
    new Date(firstTour.scheduled_tour_date).getTime() -
    new Date(secondTour.scheduled_tour_date).getTime()
  ) * multiplier);
}

function TrackBadge({ trackInfo }) {
  if (!trackInfo?.label) return null;

  return (
    <span className="pipeline-track-badge" title={trackInfo.label}>
      {trackInfo.shortLabel || trackInfo.label}
    </span>
  );
}

function PipelineCard({ tour, onMove, isMoving, trackInfo }) {
  const navigate = useNavigate();
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const status = pipelineStatuses.find((item) => item.value === tour.current_status);
  const StatusIcon = status?.icon;
  const familyName = tour.family_name.endsWith("Family")
    ? tour.family_name
    : `${tour.family_name} Family`;
  const moveOptions = nextStageActions[tour.current_status] || [];

  function confirmMove() {
    if (!pendingStatus) {
      return;
    }
    onMove(tour.id, pendingStatus);
    setIsMoveMenuOpen(false);
    setPendingStatus("");
  }

  return (
    <article className="pipeline-card">
      <div className="pipeline-card__content">
        <div>
          <h3>{familyName}</h3>
          <p>{toTitleCaseWords(tour.location_name)}</p>
          <p>{formatTourDateTime(tour.scheduled_tour_date)}</p>
        </div>
        <div className="pipeline-card__side">
          <span className="pipeline-status-cluster">
            <span className={`pipeline-card__badge status-color--${tour.current_status}`}>
              {StatusIcon && <StatusIcon aria-hidden="true" />}
              <span>{status?.label || tour.status_label}</span>
            </span>
            <TrackBadge trackInfo={trackInfo} />
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
            {moveOptions.length > 0 && (
              <button
                className="pipeline-card__move-trigger"
                type="button"
                aria-expanded={isMoveMenuOpen}
                aria-label={`Move ${familyName} to next stage`}
                disabled={isMoving}
                onClick={() => setIsMoveMenuOpen((isOpen) => !isOpen)}
              >
                <MoveRight aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
      {isMoveMenuOpen && moveOptions.length > 0 && (
        <div className="pipeline-card__moves" aria-label={`Move ${familyName}`}>
          {moveOptions.map((action) => (
            <button
              type="button"
              key={action.value}
              disabled={isMoving}
              aria-pressed={pendingStatus === action.value}
              onClick={() => setPendingStatus(action.value)}
            >
              {action.label}
            </button>
          ))}
          <button
            className="pipeline-card__move-confirm"
            type="button"
            aria-label={`Confirm move for ${familyName}`}
            disabled={isMoving || !pendingStatus}
            onClick={confirmMove}
          >
            <Check aria-hidden="true" />
            <span>{isMoving ? "Moving" : "Confirm"}</span>
          </button>
          <button
            className="pipeline-card__move-cancel"
            type="button"
            disabled={isMoving}
            onClick={() => {
              setPendingStatus("");
              setIsMoveMenuOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}

function PipelineKanbanCard({ tour, onMove, isMoving, onTouchDrop, trackInfo }) {
  const navigate = useNavigate();
  const touchDragRef = useRef(null);
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchPreview, setTouchPreview] = useState(null);
  const [pendingStatus, setPendingStatus] = useState("");
  const status = pipelineStatuses.find((item) => item.value === tour.current_status);
  const StatusIcon = status?.icon;
  const familyName = tour.family_name.endsWith("Family")
    ? tour.family_name
    : `${tour.family_name} Family`;
  const moveOptions = nextStageActions[tour.current_status] || [];

  function beginTouchDrag(event) {
    if (event.pointerType === "mouse" || isMoving) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setTouchPreview({
      x: event.clientX,
      y: event.clientY,
    });
    setIsTouchDragging(true);
  }

  function continueTouchDrag(event) {
    const drag = touchDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (distance > 8) {
      drag.moved = true;
    }
    setTouchPreview({
      x: event.clientX,
      y: event.clientY,
    });
  }

  function finishTouchDrag(event) {
    const drag = touchDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    touchDragRef.current = null;
    setIsTouchDragging(false);
    setTouchPreview(null);

    if (drag.moved) {
      onTouchDrop(tour.id, event.clientX, event.clientY);
    }
  }

  function confirmMove() {
    if (!pendingStatus) {
      return;
    }
    onMove(tour.id, pendingStatus);
    setIsMoveMenuOpen(false);
    setPendingStatus("");
  }

  return (
    <article
      className={`pipeline-kanban-card pipeline-kanban-card--${tour.current_status} ${
        isTouchDragging ? "is-touch-dragging" : ""
      }`}
      draggable={!isMoving}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(tour.id));
      }}
    >
      <button
        className="pipeline-kanban-card__grab"
        type="button"
        aria-label={`Drag ${familyName}`}
        disabled={isMoving}
        onPointerDown={beginTouchDrag}
        onPointerMove={continueTouchDrag}
        onPointerCancel={finishTouchDrag}
        onPointerUp={finishTouchDrag}
      >
        ⋮⋮
      </button>
      <div className="pipeline-kanban-card__body">
        <div className="pipeline-kanban-card__heading">
          <h3>{familyName}</h3>
          <span className="pipeline-status-cluster pipeline-status-cluster--kanban">
            <span className={`pipeline-kanban-card__badge status-color--${tour.current_status}`}>
              {StatusIcon && <StatusIcon aria-hidden="true" />}
              <span>{status?.label || tour.status_label}</span>
            </span>
            <TrackBadge trackInfo={trackInfo} />
          </span>
        </div>
        <p>{toTitleCaseWords(tour.location_name)}</p>
        <p>{formatTourDateTime(tour.scheduled_tour_date)}</p>
        <div className="pipeline-kanban-card__actions" aria-label={`${familyName} actions`}>
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
          {moveOptions.length > 0 && (
            <button
              type="button"
              aria-expanded={isMoveMenuOpen}
              aria-label={`Move ${familyName} to next stage`}
              disabled={isMoving}
              onClick={() => setIsMoveMenuOpen((isOpen) => !isOpen)}
            >
              <MoveRight aria-hidden="true" />
            </button>
          )}
        </div>
        {isMoveMenuOpen && moveOptions.length > 0 && (
          <div className="pipeline-kanban-card__moves" aria-label={`Move ${familyName}`}>
            {moveOptions.map((action) => (
              <button
                type="button"
                key={action.value}
                disabled={isMoving}
                aria-pressed={pendingStatus === action.value}
                onClick={() => setPendingStatus(action.value)}
              >
                {action.label}
              </button>
            ))}
            <div className="pipeline-kanban-card__move-actions">
              <button
                className="pipeline-kanban-card__move-confirm"
                type="button"
                disabled={isMoving || !pendingStatus}
                onClick={confirmMove}
              >
                <Check aria-hidden="true" />
                <span>{isMoving ? "Moving" : "Confirm"}</span>
              </button>
              <button
                className="pipeline-kanban-card__move-cancel"
                type="button"
                disabled={isMoving}
                onClick={() => {
                  setPendingStatus("");
                  setIsMoveMenuOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {isTouchDragging && touchPreview && (
        <div
          className={`pipeline-kanban-card__touch-preview pipeline-kanban-card__touch-preview--${tour.current_status}`}
          style={{
            "--touch-x": `${touchPreview.x}px`,
            "--touch-y": `${touchPreview.y}px`,
          }}
          aria-hidden="true"
        >
          <strong>{familyName}</strong>
          <span>{status?.label || tour.status_label}</span>
        </div>
      )}
    </article>
  );
}

function PipelineFlowDiagram() {
  return (
    <div className="pipeline-flow-panel" aria-label="Pipeline status flow">
      <div className="pipeline-kanban__flow pipeline-kanban__flow--branching" aria-hidden="true">
        <div className="pipeline-kanban__flow-path">
          <div className="pipeline-kanban__flow-node pipeline-kanban__flow-node--scheduled">
            <span><CalendarCheck aria-hidden="true" /></span>
            <strong>Booked</strong>
          </div>
          <div className="pipeline-kanban__flow-split">
            <MoveRight aria-hidden="true" />
            <span>to</span>
          </div>
          <div className="pipeline-kanban__flow-node pipeline-kanban__flow-node--toured">
            <span><UserRoundCheck aria-hidden="true" /></span>
            <strong>Toured</strong>
          </div>
          <div className="pipeline-kanban__flow-split">
            <MoveRight aria-hidden="true" />
            <span>to</span>
          </div>
          <div className="pipeline-kanban__flow-node pipeline-kanban__flow-node--enrolled">
            <span><GraduationCap aria-hidden="true" /></span>
            <strong>Enrolled</strong>
          </div>
        </div>
        <div className="pipeline-kanban__flow-path pipeline-kanban__flow-path--branch">
          <span className="pipeline-kanban__flow-branch-label">or</span>
          <div className="pipeline-kanban__flow-node pipeline-kanban__flow-node--no_show">
            <span><X aria-hidden="true" /></span>
            <strong>No Show</strong>
          </div>
          <span className="pipeline-kanban__flow-branch-label">or</span>
          <div className="pipeline-kanban__flow-node pipeline-kanban__flow-node--churned">
            <span><UserRoundX aria-hidden="true" /></span>
            <strong>Churned</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pipeline() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tours, setTours] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [filters, setFilters] = useState(() => createDefaultTourFilters(user, {
    datePreset: "all_time",
  }));
  const [averageDaysToEnroll, setAverageDaysToEnroll] = useState(null);
  const [activeStatus, setActiveStatus] = useState("scheduled");
  const [viewMode, setViewMode] = useState("stages");
  const [movingTourId, setMovingTourId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState("");
  const [sortDirection, setSortDirection] = useState("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const requestedStatus = searchParams.get("status");
    if (pipelineStatuses.some((status) => status.value === requestedStatus)) {
      // The URL can deep-link users from Home directly into a status-focused Pipeline view.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveStatus(requestedStatus);
      setViewMode("stages");
    }
    const requestedCategory = searchParams.get("category");
    const nextCategories = requestedCategory?.split(",").filter(Boolean) || [];
    setFilters((currentFilters) => {
      const currentCategories = currentFilters.categories || [];
      if (
        currentCategories.length === nextCategories.length &&
        currentCategories.every((category, index) => category === nextCategories[index])
      ) {
        return currentFilters;
      }
      return {
        ...currentFilters,
        categories: nextCategories,
      };
    });
  }, [searchParams]);

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
        const locationFilter = joinFilterValues(filters.locations);
        const leadSourceFilter = joinFilterValues(filters.leadSources);
        const [tourData, nextAverageDaysToEnroll] = await Promise.all([
          listTours({
          date_from: dateRange.dateFrom || undefined,
          date_to: dateRange.dateTo || undefined,
          location: locationFilter,
          lead_source: leadSourceFilter,
          status: joinFilterValues(filters.statuses),
          search: filters.search || undefined,
          }),
          loadAverageDaysToEnroll({
            location: locationFilter,
            lead_source: leadSourceFilter,
          }),
        ]);

        if (isCurrent) {
          const nextTours = Array.isArray(tourData) ? tourData : tourData.results || [];
          setAverageDaysToEnroll(nextAverageDaysToEnroll);
          setTours(filterToursByTrackCategory(
            nextTours,
            filters.categories,
            nextAverageDaysToEnroll,
          ));
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

  const sortedTours = useMemo(
    () => sortToursByTime(tours, sortDirection),
    [sortDirection, tours],
  );

  const groupedTours = useMemo(
    () =>
      pipelineStatuses.reduce((groups, status) => {
        groups[status.value] = sortedTours.filter(
          (tour) => tour.current_status === status.value,
        );
        return groups;
      }, {}),
    [sortedTours],
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
    const tourToMove = tours.find((tour) => tour.id === tourId);

    if (!tourToMove || tourToMove.current_status === status) {
      return;
    }

    const allowedStatuses = nextStageActions[tourToMove.current_status]?.map((action) => action.value) || [];

    if (!allowedStatuses.includes(status)) {
      setError("That move is not available from the current stage.");
      return;
    }

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

  function handleKanbanDrop(event, status) {
    event.preventDefault();
    setDragOverStatus("");
    const tourId = Number(event.dataTransfer.getData("text/plain"));
    if (tourId) {
      moveTour(tourId, status);
    }
  }

  function handleTouchKanbanDrop(tourId, clientX, clientY) {
    const target = document
      .elementFromPoint(clientX, clientY)
      ?.closest("[data-pipeline-status]");
    const status = target?.getAttribute("data-pipeline-status");

    if (status) {
      moveTour(tourId, status);
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
          defaultDatePresetValue="all_time"
          onSortToggle={() => setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))}
          searchPlaceholder="Search family name"
          showStatus={false}
          showSort
          showCategory
          sortDirection={sortDirection}
          staffLocationLabel={user?.location_name}
          staffLocationOnly={user?.role === "staff"}
        />
      </div>

      <div className="pipeline-viewbar" aria-label="Pipeline view selector">
        <div className="pipeline-viewbar__summary">
          <div>
            <p>Status Tracker</p>
          </div>
          <strong>{sortedTours.length} tours</strong>
        </div>
        <div className="pipeline-view-toggle" role="group" aria-label="Choose pipeline view">
          <button
            className={viewMode === "stages" ? "is-active" : ""}
            type="button"
            aria-pressed={viewMode === "stages"}
            onClick={() => setViewMode("stages")}
          >
            <ListChecks aria-hidden="true" />
            <span>Card view</span>
          </button>
          <button
            className={viewMode === "kanban" ? "is-active" : ""}
            type="button"
            aria-pressed={viewMode === "kanban"}
            onClick={() => setViewMode("kanban")}
          >
            <Columns3 aria-hidden="true" />
            <span>Board view</span>
          </button>
        </div>
      </div>

      {error && <p className="pipeline-state pipeline-state--error">{error}</p>}
      {isLoading && <p className="pipeline-state">Loading pipeline...</p>}

      <PipelineFlowDiagram />

      {viewMode === "stages" ? (
      <div className="pipeline-board pipeline-board--stages">
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
                  trackInfo={getTourTrackInfo(tour, averageDaysToEnroll)}
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
      ) : (
        <section className="pipeline-kanban" aria-label="Pipeline kanban board">
          <div className="pipeline-kanban__columns">
            {pipelineStatuses.map((status) => {
              const Icon = status.icon;
              const groupTours = groupedTours[status.value] || [];

              return (
                <section
                  className={`pipeline-kanban__column pipeline-kanban__column--${status.value} ${
                    dragOverStatus === status.value ? "is-drop-target" : ""
                  }`}
                  key={status.value}
                  data-pipeline-status={status.value}
                  aria-label={`${status.label} kanban column`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverStatus(status.value);
                  }}
                  onDragLeave={() => setDragOverStatus("")}
                  onDrop={(event) => handleKanbanDrop(event, status.value)}
                >
                  <header className="pipeline-kanban__column-header">
                    <span className="pipeline-kanban__column-icon"><Icon aria-hidden="true" /></span>
                    <div>
                      <h3>{status.label}</h3>
                    </div>
                    <strong>{groupTours.length}</strong>
                  </header>

                  <div className="pipeline-kanban__column-body">
                    {groupTours.length > 0 ? (
                      groupTours.map((tour) => (
                        <PipelineKanbanCard
                          key={tour.id}
                          tour={tour}
                          trackInfo={getTourTrackInfo(tour, averageDaysToEnroll)}
                          isMoving={movingTourId === tour.id}
                          onMove={moveTour}
                          onTouchDrop={handleTouchKanbanDrop}
                        />
                      ))
                    ) : (
                      <p className="pipeline-empty">No tours in this status.</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}

export default Pipeline;
