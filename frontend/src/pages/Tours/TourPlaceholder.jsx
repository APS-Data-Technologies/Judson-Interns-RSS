import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui";
import {
  getLeadSources,
  getLocations,
  getTour,
  getTourEvents,
  rescheduleTour,
  updateTour,
} from "../../features/tours/tourApi";
import useUnsavedChangesPrompt from "../../hooks/useUnsavedChangesPrompt";
import "./TourPlaceholder.css";

function formatDateTime(value) {
  if (!value) return "";
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

function getFormFromTour(tour) {
  return {
    familyName: tour.family_name || "",
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

function getFamilyDisplayName(familyName) {
  if (!familyName) return "Family";
  return familyName.endsWith("Family") ? familyName : `${familyName} Family`;
}

function TourPlaceholder({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === "edit";
  const [tour, setTour] = useState(null);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isDirty = useMemo(
    () => isEdit && form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm, isEdit],
  );

  useUnsavedChangesPrompt(isDirty && !isSaving);

  useEffect(() => {
    let isCurrent = true;

    async function loadTour() {
      setIsLoading(true);
      setError("");

      try {
        const [tourData, locationData, sourceData] = await Promise.all([
          getTour(id),
          getLocations(),
          getLeadSources(),
        ]);
        const eventData = await getTourEvents(id);

        if (!isCurrent) return;

        const nextForm = getFormFromTour(tourData);
        setTour(tourData);
        setEvents(eventData);
        setLocations(locationData);
        setLeadSources(sourceData);
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

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const scheduledTourDate = `${form.tourDate}T${form.tourTime}:00`;
      const didReschedule =
        form.tourDate !== initialForm.tourDate ||
        form.tourTime !== initialForm.tourTime;

      await updateTour(id, {
        family_name: form.familyName,
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

  return (
    <section className="tour-detail-page">
      <header className="tour-detail-hero">
        <div>
          <h1>{familyDisplayName}</h1>
          <span>{tour.status_label}</span>
        </div>
        <div className="tour-detail-hero__actions">
          <Button type="button" variant="secondary" onClick={() => navigate("/tours")}>
            Back to Tours
          </Button>
          {!isEdit && (
            <Button type="button" onClick={() => navigate(`/tours/${id}/edit`)}>
              Edit Tour
            </Button>
          )}
        </div>
      </header>

      {error && <p className="tour-detail-state tour-detail-state--error">{error}</p>}
      {message && <p className="tour-detail-state">{message}</p>}

      {isEdit ? (
        <form className="tour-edit-form" onSubmit={handleSubmit}>
          <label>
            <span>Family name</span>
            <input value={form.familyName} onChange={(event) => updateForm("familyName", event.target.value)} required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={form.contactEmail} onChange={(event) => updateForm("contactEmail", event.target.value)} />
          </label>
          <label>
            <span>Phone</span>
            <input type="tel" value={form.contactPhone} onChange={(event) => updateForm("contactPhone", event.target.value)} />
          </label>
          <label>
            <span>Location</span>
            <select value={form.location} onChange={(event) => updateForm("location", event.target.value)} required>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.location_name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Lead source</span>
            <select value={form.leadSource} onChange={(event) => updateForm("leadSource", event.target.value)} required>
              {leadSources.map((source) => (
                <option key={source.id} value={source.id}>{source.source_name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Grade</span>
            <input value={form.childGrade} onChange={(event) => updateForm("childGrade", event.target.value)} />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={form.tourDate} onChange={(event) => updateForm("tourDate", event.target.value)} required />
          </label>
          <label>
            <span>Time</span>
            <input type="time" value={form.tourTime} onChange={(event) => updateForm("tourTime", event.target.value)} required />
          </label>
          <label className="tour-edit-form__wide">
            <span>Notes</span>
            <textarea rows="4" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
          </label>
          <div className="tour-edit-form__actions">
            <Button type="button" variant="secondary" onClick={() => navigate("/tours")}>
              Cancel
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
              <div><dt>Location</dt><dd>{tour.location_name}</dd></div>
              <div><dt>Lead source</dt><dd>{tour.lead_source_name}</dd></div>
              <div><dt>Grade</dt><dd>{tour.child_grade || "Not set"}</dd></div>
              <div><dt>Assigned staff</dt><dd>{tour.assigned_staff_name}</dd></div>
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
                    <p>{event.notes || `Updated by ${event.updated_by_name}`}</p>
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
