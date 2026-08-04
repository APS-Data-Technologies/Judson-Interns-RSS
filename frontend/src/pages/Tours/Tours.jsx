import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarCheck, Eye, GraduationCap, Pencil, UserRoundCheck, UserRoundX, X } from "lucide-react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import { Button } from "../../components/ui";
import useAuth from "../../features/auth/useAuth";
import {
  createDefaultTourFilters,
  getDateRange,
  joinFilterValues,
  statusLabels,
  todayValue,
} from "../../features/tours/filterConfig";
import { gradeOptions } from "../../features/tours/gradeOptions";
import {
  getLeadSources,
  getLocations,
  getTour,
  getTourEvents,
  listTours,
  rescheduleTour,
  updateTour,
} from "../../features/tours/tourApi";
import {
  filterToursByTrackCategory,
  getTourTrackInfo,
  loadAverageDaysToEnroll,
} from "../../features/tours/tourTrackUtils";
import { toTitleCaseWords } from "../../utils/displayText";
import "./Tours.css";

const tourStatusIcons = {
  scheduled: CalendarCheck,
  toured: UserRoundCheck,
  no_show: X,
  enrolled: GraduationCap,
  churned: UserRoundX,
};

function formatTourDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function toTimeInput(value) {
  return value ? new Date(value).toISOString().slice(11, 16) : "";
}

function getTourForm(tour) {
  return {
    familyName: tour.family_name || "",
    studentName: tour.student_name || "",
    contactEmail: tour.contact_email || "",
    contactPhone: tour.contact_phone || "",
    location: tour.location ? String(tour.location) : "",
    leadSource: tour.lead_source ? String(tour.lead_source) : "",
    childGrade: tour.child_grade || "",
    tourDate: toDateInput(tour.scheduled_tour_date),
    tourTime: toTimeInput(tour.scheduled_tour_date),
    notes: "",
  };
}

const compactLayoutQuery = "(hover: none), (pointer: coarse), (max-width: 1180px)";

function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(compactLayoutQuery).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(compactLayoutQuery);

    function handleChange() {
      setIsPortrait(mediaQuery.matches);
    }

    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isPortrait;
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
    <span className="tour-track-badge" title={trackInfo.label}>
      {trackInfo.shortLabel || trackInfo.label}
    </span>
  );
}

function TourCard({ isSelected, onEdit, onSelect, onView, tour, trackInfo }) {
  const navigate = useNavigate();
  const statusLabel = statusLabels[tour.current_status] || tour.status_label;
  const StatusIcon = tourStatusIcons[tour.current_status];
  const familyName = tour.family_name;

  return (
    <article className={`tour-card ${isSelected ? "tour-card--selected" : ""}`}>
      <div className="tour-card__content">
        <button className="tour-card__main" type="button" onClick={onSelect}>
          <h2>{familyName}</h2>
          <p>{toTitleCaseWords(tour.location_name)}</p>
          <p>{formatTourDateTime(tour.scheduled_tour_date)}</p>
        </button>
        <div className="tour-card__side">
          <span className="tour-status-cluster">
            <span className={`tour-status tour-card__status status-color--${tour.current_status}`}>
              {StatusIcon && <StatusIcon aria-hidden="true" />}
              <span>{statusLabel}</span>
            </span>
            <TrackBadge trackInfo={trackInfo} />
          </span>
          <div className="tour-card__actions" aria-label={`${familyName} actions`}>
            <button
              type="button"
              aria-label={`View ${familyName} details`}
              onClick={onView || (() => navigate(`/tours/${tour.id}`))}
            >
              <Eye aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Edit ${familyName}`}
              onClick={onEdit || (() => navigate(`/tours/${tour.id}/edit`))}
            >
              <Pencil aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TourDetailPane({
  averageDaysToEnroll,
  leadSources,
  locations,
  mode,
  onModeChange,
  onSaved,
  selectedTour,
}) {
  const [tour, setTour] = useState(null);
  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadTour() {
      if (!selectedTour?.id) {
        setTour(null);
        setForm(null);
        setInitialForm(null);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const [tourData, eventData] = await Promise.all([
          getTour(selectedTour.id),
          getTourEvents(selectedTour.id),
        ]);
        if (!isCurrent) return;
        const nextForm = getTourForm(tourData);
        setTour(tourData);
        setEvents(eventData);
        setForm(nextForm);
        setInitialForm(nextForm);
      } catch {
        if (isCurrent) {
          setError("Unable to load tour details.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadTour();

    return () => {
      isCurrent = false;
    };
  }, [selectedTour?.id]);

  function updateForm(name, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!tour || !form || !initialForm) return;

    setIsSaving(true);
    setError("");

    try {
      const scheduledTourDate = `${form.tourDate}T${form.tourTime}:00`;
      const didReschedule =
        form.tourDate !== initialForm.tourDate ||
        form.tourTime !== initialForm.tourTime;

      await updateTour(tour.id, {
        family_name: form.familyName,
        student_name: form.studentName,
        contact_email: form.contactEmail,
        contact_phone: form.contactPhone,
        location: Number(form.location),
        lead_source: Number(form.leadSource),
        child_grade: form.childGrade,
      });

      if (didReschedule) {
        await rescheduleTour(tour.id, {
          scheduled_tour_date: scheduledTourDate,
          notes: form.notes || "Tour rescheduled.",
        });
      }

      const updatedTour = await getTour(tour.id);
      const nextForm = getTourForm(updatedTour);
      setTour(updatedTour);
      setForm(nextForm);
      setInitialForm(nextForm);
      onSaved(updatedTour);
      onModeChange("view");
    } catch {
      setError("Unable to save tour.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!selectedTour) {
    return (
      <aside className="tours-detail-pane">
        <p className="tours-state">Select a tour to view details.</p>
      </aside>
    );
  }

  if (isLoading || !tour || !form) {
    return (
      <aside className="tours-detail-pane">
        <p className="tours-state">Loading tour details...</p>
      </aside>
    );
  }

  const familyName = tour.family_name;
  const trackInfo = getTourTrackInfo({ ...tour, events }, averageDaysToEnroll);

  return (
    <aside className="tours-detail-pane" aria-label="Selected tour details">
      <header className="tours-detail-pane__header">
        <div className="tours-detail-pane__title">
          <h2>{familyName}</h2>
          <span className="tour-status-cluster tour-status-cluster--detail">
            <span className={`tour-status tour-status--power status-color--${tour.current_status}`}>
              {statusLabels[tour.current_status] || tour.status_label}
            </span>
            <TrackBadge trackInfo={trackInfo} />
          </span>
        </div>
        <div className="tours-detail-pane__actions">
          <Button
            type="button"
            variant={mode === "view" ? "primary" : "secondary"}
            onClick={() => onModeChange("view")}
          >
            Details
          </Button>
          <Button
            type="button"
            variant={mode === "edit" ? "primary" : "secondary"}
            onClick={() => onModeChange("edit")}
          >
            Edit
          </Button>
        </div>
      </header>

      {error && <p className="tours-state tours-state--error">{error}</p>}

      {mode === "edit" ? (
        <form className="tours-inline-form" onSubmit={handleSubmit}>
          <label><span>Family name</span><input value={form.familyName} onChange={(event) => updateForm("familyName", event.target.value)} required /></label>
          <label><span>Student name</span><input value={form.studentName} onChange={(event) => updateForm("studentName", event.target.value)} /></label>
          <label><span>Email</span><input type="email" value={form.contactEmail} onChange={(event) => updateForm("contactEmail", event.target.value)} /></label>
          <label><span>Phone</span><input type="tel" value={form.contactPhone} onChange={(event) => updateForm("contactPhone", event.target.value)} /></label>
          <label><span>Location</span><select value={form.location} onChange={(event) => updateForm("location", event.target.value)} required>{locations.map((location) => <option key={location.id} value={location.id}>{toTitleCaseWords(location.location_name)}</option>)}</select></label>
          <label><span>Lead source</span><select value={form.leadSource} onChange={(event) => updateForm("leadSource", event.target.value)} required>{leadSources.map((source) => <option key={source.id} value={source.id}>{toTitleCaseWords(source.source_name)}</option>)}</select></label>
          <label><span>Grade</span><select value={form.childGrade} onChange={(event) => updateForm("childGrade", event.target.value)}><option value="">Select grade</option>{gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>
          <label><span>Date</span><input type="date" value={form.tourDate} onChange={(event) => updateForm("tourDate", event.target.value)} required /></label>
          <label><span>Time</span><input type="time" value={form.tourTime} onChange={(event) => updateForm("tourTime", event.target.value)} required /></label>
          <label className="tours-inline-form__wide"><span>Notes</span><textarea rows="3" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></label>
          <div className="tours-inline-form__actions">
            <Button type="button" variant="secondary" onClick={() => onModeChange("view")}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save Tour"}</Button>
          </div>
        </form>
      ) : (
        <div className="tours-detail-stack">
          <section className="tours-detail-card">
            <h3>Tour Info</h3>
            <dl className="tours-detail-list">
              <div><dt>Scheduled</dt><dd>{formatTourDateTime(tour.scheduled_tour_date)}</dd></div>
              <div><dt>Location</dt><dd>{toTitleCaseWords(tour.location_name)}</dd></div>
              <div><dt>Lead source</dt><dd>{toTitleCaseWords(tour.lead_source_name)}</dd></div>
              <div><dt>Student</dt><dd>{tour.student_name || "Not set"}</dd></div>
              <div><dt>Grade</dt><dd>{tour.child_grade || "Not set"}</dd></div>
              <div><dt>Assigned staff</dt><dd>{toTitleCaseWords(tour.assigned_staff_name) || "Not assigned"}</dd></div>
            </dl>
          </section>

          <section className="tours-detail-card">
            <h3>Family Contact</h3>
            <dl className="tours-detail-list">
              <div><dt>Family</dt><dd>{tour.family_name}</dd></div>
              <div><dt>Email</dt><dd>{tour.contact_email || "Not set"}</dd></div>
              <div><dt>Phone</dt><dd>{tour.contact_phone || "Not set"}</dd></div>
            </dl>
          </section>

          <section className="tours-detail-card">
            <h3>Event History</h3>
            <div className="tours-events">
              {events.length ? (
                events.map((event) => (
                  <article key={event.id}>
                    <strong>{event.status_label}</strong>
                    <span>{formatTourDateTime(event.event_timestamp)}</span>
                    <p>{event.notes || `Updated by ${toTitleCaseWords(event.updated_by_name)}`}</p>
                  </article>
                ))
              ) : (
                <p className="tours-events__empty">No event history yet.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

function ToursWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPortrait = useIsPortrait();
  const queryFilters = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get("date") || "";
    const datePreset = dateParam && dateParam !== todayValue() ? "custom" : "today";
    return {
      datePreset,
      dateFrom: dateParam && datePreset === "custom" ? dateParam : "",
      dateTo: dateParam && datePreset === "custom" ? dateParam : "",
      hasDateParam: Boolean(dateParam),
      statuses: params.get("status")?.split(",").filter(Boolean) || [],
      categories: params.get("category")?.split(",").filter(Boolean) || [],
    };
  }, [location.search]);
  const [tours, setTours] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [filters, setFilters] = useState(() => createDefaultTourFilters(user, {
    datePreset: queryFilters.hasDateParam ? queryFilters.datePreset : "all_time",
    dateFrom: queryFilters.dateFrom,
    dateTo: queryFilters.dateTo,
    statuses: queryFilters.statuses,
    categories: queryFilters.categories,
  }));
  const [averageDaysToEnroll, setAverageDaysToEnroll] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTourId, setSelectedTourId] = useState(null);
  const [detailMode, setDetailMode] = useState("view");
  const [sortDirection, setSortDirection] = useState("desc");

  const sortedTours = useMemo(
    () => sortToursByTime(tours, sortDirection),
    [sortDirection, tours],
  );
  const selectedTour = sortedTours.find((tour) => tour.id === selectedTourId) || sortedTours[0] || null;

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
          status: joinFilterValues(filters.statuses),
          location: locationFilter,
          lead_source: leadSourceFilter,
          date_from: dateRange.dateFrom || undefined,
          date_to: dateRange.dateTo || undefined,
          search: filters.search || undefined,
          }),
          loadAverageDaysToEnroll({
            location: locationFilter,
            lead_source: leadSourceFilter,
          }),
        ]);

        if (isCurrent) {
          const nextTours = Array.isArray(tourData) ? tourData : tourData.results || [];
          const nextFilteredTours = filterToursByTrackCategory(
            nextTours,
            filters.categories,
            nextAverageDaysToEnroll,
          );
          setAverageDaysToEnroll(nextAverageDaysToEnroll);
          setTours(nextFilteredTours);
          setSelectedTourId((currentId) => {
            if (nextFilteredTours.some((tour) => tour.id === currentId)) {
              return currentId;
            }
            return nextFilteredTours[0]?.id || null;
          });
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

  function updateTourInList(updatedTour) {
    setTours((currentTours) =>
      currentTours.map((tour) => (tour.id === updatedTour.id ? updatedTour : tour)),
    );
  }

  function handleSortToggle() {
    setSortDirection((currentDirection) => {
      const nextDirection = currentDirection === "asc" ? "desc" : "asc";
      const nextFirstTour = sortToursByTime(tours, nextDirection)[0];
      setSelectedTourId(nextFirstTour?.id || null);
      setDetailMode("view");
      return nextDirection;
    });
  }

  return (
    <section className="tours-page" aria-label="Tours list">
      <TourFilterControls
        filters={filters}
        leadSources={leadSources}
        locations={locations}
        onChange={updateFilter}
        defaultDatePresetValue="all_time"
        onSortToggle={handleSortToggle}
        searchPlaceholder="Search family name"
        showSort
        showCategory
        sortDirection={sortDirection}
        staffLocationLabel={user?.location_name}
        staffLocationOnly={user?.role === "staff"}
      />

      {error && <p className="tours-state tours-state--error">{error}</p>}
      {isLoading && <p className="tours-state">Loading tours...</p>}

      <div className="tours-workspace">
        <div className="tours-list">
        {!isLoading && sortedTours.length === 0 && (
          <p className="tours-state">No tours match these filters.</p>
        )}
        {sortedTours.map((tour) => (
          <TourCard
            key={tour.id}
            tour={tour}
            trackInfo={getTourTrackInfo(tour, averageDaysToEnroll)}
            isSelected={selectedTour?.id === tour.id}
            onSelect={() => {
              setSelectedTourId(tour.id);
              setDetailMode("view");
            }}
            onView={() => {
              if (isPortrait) {
                navigate(`/tours/${tour.id}`);
                return;
              }
              setSelectedTourId(tour.id);
              setDetailMode("view");
            }}
            onEdit={() => {
              if (isPortrait) {
                navigate(`/tours/${tour.id}/edit`);
                return;
              }
              setSelectedTourId(tour.id);
              setDetailMode("edit");
            }}
          />
        ))}
        </div>

        <TourDetailPane
          averageDaysToEnroll={averageDaysToEnroll}
          leadSources={leadSources}
          locations={locations}
          mode={detailMode}
          onModeChange={setDetailMode}
          onSaved={updateTourInList}
          selectedTour={selectedTour}
        />
      </div>
    </section>
  );
}

function Tours() {
  const location = useLocation();
  return <ToursWorkspace key={location.search} />;
}

export default Tours;
