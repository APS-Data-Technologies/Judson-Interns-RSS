import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../components/ui";
import {
  createTour,
  getLeadSources,
  getLocations,
} from "../../features/tours/tourApi";
import useUnsavedChangesPrompt from "../../hooks/useUnsavedChangesPrompt";
import "./NewTour.css";

function getInitialForm() {
  return {
    familyName: "",
    studentName: "",
    phone: "",
    email: "",
    location: "",
    leadSource: "",
    childGrade: "",
    tourDate: new Date().toISOString().slice(0, 10),
    tourTime: "09:00",
    notes: "",
  };
}

function NewTour() {
  const navigate = useNavigate();
  const [initialForm, setInitialForm] = useState(getInitialForm);
  const [form, setForm] = useState(initialForm);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  useUnsavedChangesPrompt(
    isDirty && !isSubmitting && !isSaved,
    "You have unsaved tour details. Leave without saving?",
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadOptions() {
      setIsLoading(true);
      setError("");

      try {
        const [locationData, sourceData] = await Promise.all([
          getLocations(),
          getLeadSources(),
        ]);

        if (!isCurrent) {
          return;
        }

        setLocations(locationData);
        setLeadSources(sourceData);

        const nextInitialForm = {
          ...getInitialForm(),
          location: locationData[0]?.id ? String(locationData[0].id) : "",
          leadSource: sourceData[0]?.id ? String(sourceData[0].id) : "",
        };
        setInitialForm(nextInitialForm);
        setForm(nextInitialForm);
      } catch {
        if (isCurrent) {
          setError("Unable to load tour options.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadOptions();

    return () => {
      isCurrent = false;
    };
  }, []);

  function updateForm(name, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await createTour({
        family_name: form.familyName,
        student_name: form.studentName,
        contact_phone: form.phone,
        contact_email: form.email,
        location: Number(form.location),
        lead_source: Number(form.leadSource),
        child_grade: form.childGrade,
        scheduled_tour_date: `${form.tourDate}T${form.tourTime}:00`,
        notes: form.notes,
      });
      setIsSaved(true);
      navigate("/tours");
    } catch (requestError) {
      const responseData = requestError.response?.data;
      const message =
        responseData?.detail ||
        responseData?.non_field_errors?.[0] ||
        "Unable to save tour.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="new-tour-page" aria-label="Add tour">
      {error && <p className="new-tour-state new-tour-state--error">{error}</p>}
      {isLoading && <p className="new-tour-state">Loading tour options...</p>}

      <form className="new-tour-form" onSubmit={handleSubmit}>
        <label>
          <span>Family name</span>
          <input
            value={form.familyName}
            onChange={(event) => updateForm("familyName", event.target.value)}
            required
          />
        </label>
        <label>
          <span>Student name</span>
          <input
            value={form.studentName}
            onChange={(event) => updateForm("studentName", event.target.value)}
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => updateForm("phone", event.target.value)}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateForm("email", event.target.value)}
          />
        </label>
        <label>
          <span>Location</span>
          <select
            value={form.location}
            onChange={(event) => updateForm("location", event.target.value)}
            required
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.location_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Lead source</span>
          <select
            value={form.leadSource}
            onChange={(event) => updateForm("leadSource", event.target.value)}
            required
          >
            {leadSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.source_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Grade</span>
          <input
            value={form.childGrade}
            onChange={(event) => updateForm("childGrade", event.target.value)}
          />
        </label>
        <label>
          <span>Date</span>
          <input
            type="date"
            value={form.tourDate}
            onChange={(event) => updateForm("tourDate", event.target.value)}
            required
          />
        </label>
        <label>
          <span>Time</span>
          <input
            type="time"
            value={form.tourTime}
            onChange={(event) => updateForm("tourTime", event.target.value)}
            required
          />
        </label>
        <label className="new-tour-form__wide">
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateForm("notes", event.target.value)}
            rows="4"
          />
        </label>

        <div className="new-tour-actions">
          <Button type="button" variant="secondary" onClick={() => navigate("/tours")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? "Saving..." : "Save Tour"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default NewTour;
