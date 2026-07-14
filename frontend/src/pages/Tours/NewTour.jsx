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
    tourDate: "",
    tourTime: "",
    notes: "",
  };
}

const requiredFields = {
  familyName: "Family name is required.",
  studentName: "Student name is required.",
  phone: "Phone is required.",
  email: "Email is required.",
  location: "Location is required.",
  leadSource: "Lead source is required.",
  childGrade: "Grade is required.",
  tourDate: "Date is required.",
  tourTime: "Time is required.",
};

function NewTour() {
  const navigate = useNavigate();
  const [initialForm, setInitialForm] = useState(getInitialForm);
  const [form, setForm] = useState(initialForm);
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingAction, setPendingAction] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const navigationPrompt = useUnsavedChangesPrompt(
    isDirty && !isSubmitting && !isSaved,
    "New Tour has unsaved changes. Leave this page and discard changes?",
    { mode: "inline" },
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

        const nextInitialForm = getInitialForm();
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
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [name]: "",
    }));
    setPendingAction("");
  }

  function validateForm() {
    const nextErrors = {};
    Object.entries(requiredFields).forEach(([fieldName, message]) => {
      if (!String(form[fieldName] || "").trim()) {
        nextErrors[fieldName] = message;
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
    if (!validateForm()) {
      return;
    }
    setPendingAction("save");
  }

  async function saveTour() {
    setError("");
    setPendingAction("");
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

  function requestCancel() {
    setPendingAction("");
    navigate("/home");
  }

  return (
    <section className="new-tour-page" aria-label="Add tour">
      {error && <p className="new-tour-state new-tour-state--error">{error}</p>}
      {isLoading && <p className="new-tour-state">Loading tour options...</p>}
      {navigationPrompt.isBlocked && (
        <div className="new-tour-confirm" role="alert">
          <strong>Leave New Tour?</strong>
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

      <form className="new-tour-form" noValidate onSubmit={requestSave}>
        <label>
          <span>Family name *</span>
          <input
            value={form.familyName}
            onChange={(event) => updateForm("familyName", event.target.value)}
            aria-invalid={Boolean(fieldErrors.familyName)}
          />
          {fieldErrors.familyName && <small>{fieldErrors.familyName}</small>}
        </label>
        <label>
          <span>Student name *</span>
          <input
            value={form.studentName}
            onChange={(event) => updateForm("studentName", event.target.value)}
            aria-invalid={Boolean(fieldErrors.studentName)}
          />
          {fieldErrors.studentName && <small>{fieldErrors.studentName}</small>}
        </label>
        <label>
          <span>Phone *</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => updateForm("phone", event.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone && <small>{fieldErrors.phone}</small>}
        </label>
        <label>
          <span>Email *</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateForm("email", event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && <small>{fieldErrors.email}</small>}
        </label>
        <label>
          <span>Location *</span>
          <select
            value={form.location}
            onChange={(event) => updateForm("location", event.target.value)}
            aria-invalid={Boolean(fieldErrors.location)}
          >
            <option value="">Select location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.location_name}
              </option>
            ))}
          </select>
          {fieldErrors.location && <small>{fieldErrors.location}</small>}
        </label>
        <label>
          <span>Lead source *</span>
          <select
            value={form.leadSource}
            onChange={(event) => updateForm("leadSource", event.target.value)}
            aria-invalid={Boolean(fieldErrors.leadSource)}
          >
            <option value="">Select lead source</option>
            {leadSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.source_name}
              </option>
            ))}
          </select>
          {fieldErrors.leadSource && <small>{fieldErrors.leadSource}</small>}
        </label>
        <label>
          <span>Grade *</span>
          <input
            value={form.childGrade}
            onChange={(event) => updateForm("childGrade", event.target.value)}
            aria-invalid={Boolean(fieldErrors.childGrade)}
          />
          {fieldErrors.childGrade && <small>{fieldErrors.childGrade}</small>}
        </label>
        <label>
          <span>Date *</span>
          <input
            type="date"
            value={form.tourDate}
            onChange={(event) => updateForm("tourDate", event.target.value)}
            aria-invalid={Boolean(fieldErrors.tourDate)}
          />
          {fieldErrors.tourDate && <small>{fieldErrors.tourDate}</small>}
        </label>
        <label>
          <span>Time *</span>
          <input
            type="time"
            value={form.tourTime}
            onChange={(event) => updateForm("tourTime", event.target.value)}
            aria-invalid={Boolean(fieldErrors.tourTime)}
          />
          {fieldErrors.tourTime && <small>{fieldErrors.tourTime}</small>}
        </label>
        <label className="new-tour-form__wide">
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateForm("notes", event.target.value)}
            rows="4"
          />
        </label>

        {pendingAction === "save" && (
          <div className="new-tour-confirm" role="alert">
            <strong>Save New Tour?</strong>
            <p>Confirm that all tour details are correct before creating this tour.</p>
            <div>
              <Button type="button" variant="secondary" onClick={() => setPendingAction("")}>
                Cancel
              </Button>
              <Button type="button" disabled={isSubmitting || isLoading} onClick={saveTour}>
                Confirm Save
              </Button>
            </div>
          </div>
        )}

        <div className="new-tour-actions">
          <Button type="button" variant="secondary" onClick={requestCancel}>
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
