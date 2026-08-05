import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui";
import {
  cancelTour,
  getLeadSources,
  getLocations,
  getTour,
  getTourEvents,
  rescheduleTour,
  updateTour,
} from "../../features/tours/tourApi";
import {
  getTourTrackInfo,
  loadAverageDaysToEnroll,
} from "../../features/tours/tourTrackUtils";
import { gradeOptions } from "../../features/tours/gradeOptions";
import useUnsavedChangesPrompt from "../../hooks/useUnsavedChangesPrompt";
import { toTitleCaseWords } from "../../utils/displayText";
import {
  APPLICATION_TIME_ZONE_LABEL,
  buildApplicationDateTime,
  formatApplicationDateTime,
  toApplicationDateInput,
  toApplicationTimeInput,
} from "../../utils/timeZone";
import "./TourPlaceholder.css";

function formatDateTime(value) {
  return formatApplicationDateTime(value);
}

function toDateInput(value) {
  return toApplicationDateInput(value);
}

function toTimeInput(value) {
  return toApplicationTimeInput(value);
}

function getFormFromTour(tour) {
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

const editRequiredFields = {
  familyName: "Family name is required.",
  contactEmail: "Email is required.",
  contactPhone: "Phone is required.",
  location: "Location is required.",
  leadSource: "Lead source is required.",
  childGrade: "Grade is required.",
  tourDate: "Date is required.",
  tourTime: "Time is required.",
};

function getFamilyDisplayName(familyName) {
  return familyName || "";
}

function TrackBadge({ trackInfo }) {
  if (!trackInfo?.label) return null;

  return (
    <span className="tour-detail-track-badge" title={trackInfo.label}>
      {trackInfo.shortLabel || trackInfo.label}
    </span>
  );
}

function TourPlaceholder({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === "edit";
  const [tour, setTour] = useState(null);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [events, setEvents] = useState([]);
  const [averageDaysToEnroll, setAverageDaysToEnroll] = useState(null);
  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  const isDirty = useMemo(
    () => isEdit && form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm, isEdit],
  );

  const navigationPrompt = useUnsavedChangesPrompt(
    isDirty && !isSaving,
    "Edit Tour has unsaved changes. Leave this page and discard changes?",
    { mode: "inline" },
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadTour() {
      setIsLoading(true);
      setError("");

      try {
        const [tourData, locationData, sourceData, averageDays] = await Promise.all([
          getTour(id),
          getLocations(),
          getLeadSources(),
          loadAverageDaysToEnroll(),
        ]);
        const eventData = await getTourEvents(id);

        if (!isCurrent) return;

        const nextForm = getFormFromTour(tourData);
        setTour(tourData);
        setEvents(eventData);
        setLocations(locationData);
        setLeadSources(sourceData);
        setAverageDaysToEnroll(averageDays);
        setForm(nextForm);
        setInitialForm(nextForm);
      } catch {
        if (isCurrent) {
          setError("Unable to load tour.");
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
  }, [id]);

  function updateForm(name, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [name]: "",
    }));
    setPendingAction("");
  }

  async function refreshTour() {
    const [tourData, eventData] = await Promise.all([
      getTour(id),
      getTourEvents(id),
    ]);
    const nextForm = getFormFromTour(tourData);
    setTour(tourData);
    setEvents(eventData);
    setForm(nextForm);
    setInitialForm(nextForm);
  }

  function validateForm() {
    const nextErrors = {};
    Object.entries(editRequiredFields).forEach(([fieldName, errorMessage]) => {
      if (!String(form[fieldName] || "").trim()) {
        nextErrors[fieldName] = errorMessage;
      }
    });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Please complete the required fields before saving.");
      return false;
    }
    return true;
  }

  function requestSave(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!validateForm()) {
      return;
    }
    setPendingAction("save");
  }

  async function saveTour() {
    setError("");
    setMessage("");
    setPendingAction("");
    setIsSaving(true);

    try {
      const scheduledTourDate = buildApplicationDateTime(form.tourDate, form.tourTime);
      const didReschedule =
        form.tourDate !== initialForm.tourDate ||
        form.tourTime !== initialForm.tourTime;

      await updateTour(id, {
        family_name: form.familyName,
        student_name: form.studentName,
        contact_email: form.contactEmail,
        contact_phone: form.contactPhone,
        location: Number(form.location),
        lead_source: Number(form.leadSource),
        child_grade: form.childGrade,
      });

      if (didReschedule) {
        await rescheduleTour(id, {
          scheduled_tour_date: scheduledTourDate,
          notes: form.notes || "Tour rescheduled.",
        });
      }

      await refreshTour();
      setMessage("Tour saved.");
      navigate(`/tours/${id}`);
    } catch {
      setError("Unable to save tour.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmCancellation() {
    setError("");
    setIsSaving(true);
    try {
      const updatedTour = await cancelTour(id, { reason: cancellationReason });
      const eventData = await getTourEvents(id);
      const nextForm = getFormFromTour(updatedTour);
      setTour(updatedTour);
      setEvents(eventData);
      setForm(nextForm);
      setInitialForm(nextForm);
      setPendingAction("");
      setCancellationReason("");
      navigate(`/tours/${id}`);
    } catch {
      setError("Unable to cancel tour.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestCancel() {
    setPendingAction("");
    navigate("/tours");
  }

  if (isLoading) {
    return <p className="tour-detail-state">Loading tour...</p>;
  }

  if (error && !tour) {
    return <p className="tour-detail-state tour-detail-state--error">{error}</p>;
  }

  if (!tour || !form) {
    return <p className="tour-detail-state">Tour not found.</p>;
  }

  const familyDisplayName = getFamilyDisplayName(tour.family_name);
  const trackInfo = getTourTrackInfo({ ...tour, events }, averageDaysToEnroll);

  return (
    <section className="tour-detail-page">
      <header className="tour-detail-hero">
        <div className="tour-detail-hero__title">
          <h1>{familyDisplayName}</h1>
          <span className="tour-detail-status-cluster">
            <span className={`tour-detail-hero__status status-color--${tour.operational_status || tour.current_status}`}>
              {tour.operational_status_label || tour.status_label}
            </span>
            <TrackBadge trackInfo={trackInfo} />
          </span>
        </div>
        <div className="tour-detail-hero__actions">
          <Button type="button" variant="secondary" onClick={() => navigate("/tours")}>
            Back to Tours
          </Button>
          {!isEdit && !tour.cancelled_at && (
            <Button type="button" onClick={() => navigate(`/tours/${id}/edit`)}>
              Edit Tour
            </Button>
          )}
        </div>
      </header>

      {error && <p className="tour-detail-state tour-detail-state--error">{error}</p>}
      {message && <p className="tour-detail-state">{message}</p>}
      {navigationPrompt.isBlocked && (
        <div className="tour-detail-confirm" role="alert">
          <strong>Leave Edit Tour?</strong>
          <p>{navigationPrompt.message}</p>
          <div>
            <Button type="button" variant="secondary" onClick={navigationPrompt.reset}>
              Stay
            </Button>
            <Button type="button" onClick={navigationPrompt.proceed}>
              Leave Page
            </Button>
          </div>
        </div>
      )}

      {isEdit ? (
        <form className="tour-edit-form" noValidate onSubmit={requestSave}>
          <label>
            <span>Family name *</span>
            <input value={form.familyName} onChange={(event) => updateForm("familyName", event.target.value)} aria-invalid={Boolean(fieldErrors.familyName)} />
            {fieldErrors.familyName && <small>{fieldErrors.familyName}</small>}
          </label>
          <label>
            <span>Student name</span>
            <input value={form.studentName} onChange={(event) => updateForm("studentName", event.target.value)} />
          </label>
          <label>
            <span>Email *</span>
            <input type="email" value={form.contactEmail} onChange={(event) => updateForm("contactEmail", event.target.value)} aria-invalid={Boolean(fieldErrors.contactEmail)} />
            {fieldErrors.contactEmail && <small>{fieldErrors.contactEmail}</small>}
          </label>
          <label>
            <span>Phone *</span>
            <input type="tel" value={form.contactPhone} onChange={(event) => updateForm("contactPhone", event.target.value)} aria-invalid={Boolean(fieldErrors.contactPhone)} />
            {fieldErrors.contactPhone && <small>{fieldErrors.contactPhone}</small>}
          </label>
          <label>
            <span>Location *</span>
            <select value={form.location} onChange={(event) => updateForm("location", event.target.value)} aria-invalid={Boolean(fieldErrors.location)}>
              <option value="">Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{toTitleCaseWords(location.location_name)}</option>
              ))}
            </select>
            {fieldErrors.location && <small>{fieldErrors.location}</small>}
          </label>
          <label>
            <span>Lead source *</span>
            <select value={form.leadSource} onChange={(event) => updateForm("leadSource", event.target.value)} aria-invalid={Boolean(fieldErrors.leadSource)}>
              <option value="">Select lead source</option>
              {leadSources.map((source) => (
                <option key={source.id} value={source.id}>{toTitleCaseWords(source.source_name)}</option>
              ))}
            </select>
            {fieldErrors.leadSource && <small>{fieldErrors.leadSource}</small>}
          </label>
          <label>
            <span>Grade *</span>
            <select value={form.childGrade} onChange={(event) => updateForm("childGrade", event.target.value)} aria-invalid={Boolean(fieldErrors.childGrade)}>
              <option value="">Select grade</option>
              {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
            {fieldErrors.childGrade && <small>{fieldErrors.childGrade}</small>}
          </label>
          <label>
            <span>Date *</span>
            <input type="date" value={form.tourDate} onChange={(event) => updateForm("tourDate", event.target.value)} aria-invalid={Boolean(fieldErrors.tourDate)} />
            {fieldErrors.tourDate && <small>{fieldErrors.tourDate}</small>}
          </label>
          <label>
            <span>Time ({APPLICATION_TIME_ZONE_LABEL}) *</span>
            <input type="time" value={form.tourTime} onChange={(event) => updateForm("tourTime", event.target.value)} aria-invalid={Boolean(fieldErrors.tourTime)} />
            {fieldErrors.tourTime && <small>{fieldErrors.tourTime}</small>}
          </label>
          <label className="tour-edit-form__wide">
            <span>Notes</span>
            <textarea rows="4" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
          </label>
          {pendingAction === "save" && (
            <div className="tour-detail-confirm tour-edit-form__wide" role="alert">
              <strong>Save Edit Tour?</strong>
              <p>Confirm that the updated tour details are correct before saving.</p>
              <div>
                <Button type="button" variant="secondary" onClick={() => setPendingAction("")}>
                  Cancel
                </Button>
                <Button type="button" disabled={isSaving} onClick={saveTour}>
                  Confirm Save
                </Button>
              </div>
            </div>
          )}
          {pendingAction === "cancel-tour" && (
            createPortal(<div className="tour-cancel-overlay">
              <div className="tour-detail-confirm tour-cancel-dialog" role="alertdialog" aria-modal="true" aria-labelledby="tour-cancel-title" aria-describedby="tour-cancel-message">
                <strong id="tour-cancel-title">Cancel this tour?</strong>
                <p id="tour-cancel-message">The tour will move to No Show and display a Cancelled badge. This cannot be undone.</p>
                <label>
                  <span>Cancellation reason (optional)</span>
                  <textarea rows="3" value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} />
                </label>
                <div>
                  <Button type="button" variant="secondary" onClick={() => setPendingAction("")}>
                    Keep Tour
                  </Button>
                  <Button type="button" className="tour-cancel-confirm" disabled={isSaving} onClick={confirmCancellation}>
                    Confirm Cancellation
                  </Button>
                </div>
              </div>
            </div>, document.body)
          )}
          <div className="tour-edit-form__actions">
            {tour.current_status === "scheduled" && !tour.cancelled_at && (
              <Button type="button" className="tour-cancel-action" onClick={() => setPendingAction("cancel-tour")}>
                Cancel Tour
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={requestCancel}>
              Exit Edit
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Tour"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="tour-detail-grid">
          <section className="tour-detail-panel">
            <h2>Tour Info</h2>
            <dl>
              <div><dt>Scheduled</dt><dd>{formatDateTime(tour.scheduled_tour_date)}</dd></div>
              <div><dt>Location</dt><dd>{toTitleCaseWords(tour.location_name)}</dd></div>
              <div><dt>Lead source</dt><dd>{toTitleCaseWords(tour.lead_source_name)}</dd></div>
              <div><dt>Student</dt><dd>{tour.student_name || "Not set"}</dd></div>
              <div><dt>Grade</dt><dd>{tour.child_grade || "Not set"}</dd></div>
              <div><dt>Assigned staff</dt><dd>{toTitleCaseWords(tour.assigned_staff_name)}</dd></div>
            </dl>
          </section>

          <section className="tour-detail-panel">
            <h2>Family Contact</h2>
            <dl>
              <div><dt>Family</dt><dd>{tour.family_name}</dd></div>
              <div><dt>Email</dt><dd>{tour.contact_email || "Not set"}</dd></div>
              <div><dt>Phone</dt><dd>{tour.contact_phone || "Not set"}</dd></div>
            </dl>
          </section>

          <section className="tour-detail-panel tour-detail-panel--wide">
            <h2>Event History</h2>
            <div className="tour-events">
              {events.length ? (
                events.map((event) => (
                  <article key={event.id}>
                    <strong>{event.status_label}</strong>
                    <span>{formatDateTime(event.event_timestamp)}</span>
                    <p>{event.notes || `Updated by ${toTitleCaseWords(event.updated_by_name)}`}</p>
                  </article>
                ))
              ) : (
                <p>No event history yet.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default TourPlaceholder;
