import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, Info } from "lucide-react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import { Button } from "../../components/ui";
import useAuth from "../../features/auth/useAuth";
import {
  createDefaultTourFilters,
  todayValue,
} from "../../features/tours/filterConfig";
import { getHomeSummary, listTours } from "../../features/tours/tourApi";
import {
  getTourTrackInfo,
  loadAverageDaysToEnroll,
} from "../../features/tours/tourTrackUtils";
import { toTitleCaseWords } from "../../utils/textFormatting";
import { addApplicationCalendarDays, formatApplicationDateTime } from "../../utils/timeZone";
import "./Home.css";

const initialSummary = {
  date: "",
  booked_tours: [],
  no_show_tours: [],
  filters: {
    locations: [],
  },
};

const initialPendingSummary = {
  pendingTourOutcome: [],
  pendingEnrollmentOutcome: [],
};

function formatTourDateTime(value) {
  return formatApplicationDateTime(value);
}

function yesterdayValue() {
  return addApplicationCalendarDays(todayValue(), -1);
}

function sortToursByTime(tours) {
  return [...tours].sort((firstTour, secondTour) => (
    new Date(firstTour.scheduled_tour_date).getTime() -
    new Date(secondTour.scheduled_tour_date).getTime()
  ));
}

function sortToursOldestFirst(tours) {
  return [...tours].sort((firstTour, secondTour) => (
    new Date(firstTour.scheduled_tour_date).getTime() -
    new Date(secondTour.scheduled_tour_date).getTime()
  ));
}

function TourList({ title, tours, tone }) {
  const navigate = useNavigate();
  const status = tone === "booked" ? "scheduled" : "no_show";
  const statusLabel = tone === "booked" ? "booked" : "no show";
  const filterDate = tone === "booked" ? todayValue() : yesterdayValue();

  return (
    <article className={`home-card home-card--${tone}`}>
      <div className="home-card__header">
        <h2>{title}</h2>
        <button
          className="home-card__count"
          type="button"
          aria-label={`View ${statusLabel} tours`}
          onClick={() => navigate(`/tours?date=${filterDate}&status=${status}`)}
        >
          {tours.length}
        </button>
      </div>

      <div className="home-tour-list">
        {tours.length > 0 ? (
          tours.map((tour) => (
            <div className="home-tour-row" key={tour.id}>
              <div className="home-tour-row__family">
                <strong>{tour.family_name}</strong>
                <span>{toTitleCaseWords(tour.location_name)}</span>
              </div>
              <div className="home-tour-row__meta">
                <span>{formatTourDateTime(tour.scheduled_tour_date)}</span>
              </div>
              <button
                className="home-tour-row__view"
                type="button"
                aria-label={`View ${tour.family_name} family tour details`}
                onClick={() => navigate(`/tours/${tour.id}`)}
              >
                <Eye aria-hidden="true" />
              </button>
            </div>
          ))
        ) : (
          <p className="home-empty">No matching families found.</p>
        )}
      </div>
    </article>
  );
}

function ActionNeededInfo({
  isLoading,
  pendingEnrollmentOutcome,
  pendingTourOutcome,
}) {
  const navigate = useNavigate();
  const pendingTourCount = pendingTourOutcome.length;
  const pendingEnrollmentCount = pendingEnrollmentOutcome.length;
  const tourCountLabel = isLoading ? "…" : pendingTourCount;
  const enrollmentCountLabel = isLoading ? "…" : pendingEnrollmentCount;
  const tourReviewPath = "/pipeline?status=scheduled&category=off_track";
  const enrollmentReviewPath = "/pipeline?status=toured&category=off_track";

  return (
    <section className="home-action-info" aria-label="Pending actions">
      <div className="home-action-info__heading">
        <h2>Pending Actions</h2>
        <span className="home-action-info__hint">
          <button
            type="button"
            aria-label="Pending actions guidance"
            title="Review these tours in Pipeline and update their status."
          >
            <Info aria-hidden="true" />
          </button>
          <span role="tooltip">
            Review these tours in Pipeline and update their status.
          </span>
        </span>
      </div>
      <div className="home-action-info__actions" aria-label="Pending status updates">
        <button
          className="home-action-info__card"
          type="button"
          onClick={() => navigate(tourReviewPath)}
        >
          <span className="home-action-info__card-title">
            <strong>{tourCountLabel}</strong> scheduled tours past their tour date
          </span>
          <span className="home-action-info__card-action">
            Set Toured / No Show
            <ArrowRight aria-hidden="true" />
          </span>
        </button>
        <button
          className="home-action-info__card"
          type="button"
          onClick={() => navigate(enrollmentReviewPath)}
        >
          <span className="home-action-info__card-title">
            <strong>{enrollmentCountLabel}</strong> completed tours past the average enrollment window
          </span>
          <span className="home-action-info__card-action">
            Set Enrolled / Churned
            <ArrowRight aria-hidden="true" />
          </span>
        </button>
      </div>
    </section>
  );
}

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState(() =>
    createDefaultTourFilters(user, { datePreset: "today" }),
  );
  const [summary, setSummary] = useState(initialSummary);
  const [pendingSummary, setPendingSummary] = useState(initialPendingSummary);
  const [isPendingLoading, setIsPendingLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const bookedTours = useMemo(
    () => sortToursByTime(summary.booked_tours),
    [summary.booked_tours],
  );
  const noShowTours = useMemo(
    () => sortToursByTime(summary.no_show_tours),
    [summary.no_show_tours],
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadSummary() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getHomeSummary({
          date: todayValue(),
          location: filters.locations[0] || undefined,
          search: filters.search || undefined,
        });

        if (isCurrent) {
          setSummary(data);
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

    loadSummary();

    return () => {
      isCurrent = false;
    };
  }, [filters]);

  useEffect(() => {
    let isCurrent = true;

    async function loadPendingTours() {
      setIsPendingLoading(true);
      try {
        const locationParam = filters.locations[0] || undefined;
        const searchParam = filters.search || undefined;
        const [data, averageDaysToEnroll] = await Promise.all([
          listTours({
            location: locationParam,
            search: searchParam,
            status: "scheduled,toured",
          }),
          loadAverageDaysToEnroll({
            location: locationParam,
          }),
        ]);
        const tours = Array.isArray(data) ? data : data.results || [];

        const pendingTourOutcome = sortToursOldestFirst(
          tours.filter((tour) => getTourTrackInfo(tour, averageDaysToEnroll).type === "tour_outcome"),
        );
        const touredWithoutFinalOutcome = tours.filter((tour) => tour.current_status === "toured");
        const pendingEnrollmentOutcome = sortToursOldestFirst(
          touredWithoutFinalOutcome.filter(
            (tour) => getTourTrackInfo(tour, averageDaysToEnroll).type === "enrollment_outcome",
          ),
        );

        if (isCurrent) {
          setPendingSummary({
            pendingTourOutcome,
            pendingEnrollmentOutcome,
          });
          setIsPendingLoading(false);
        }
      } catch {
        if (isCurrent) {
          setPendingSummary(initialPendingSummary);
          setIsPendingLoading(false);
        }
      }
    }

    loadPendingTours();

    return () => {
      isCurrent = false;
    };
  }, [filters.locations, filters.search]);

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  return (
    <section className="home-page" aria-label="Home dashboard">
      <div className="home-tools" aria-label="Tour filters">
        <TourFilterControls
          filters={filters}
          leadSources={[]}
          locations={summary.filters.locations}
          onChange={updateFilter}
          lockDate
          searchPlaceholder="Search family names"
          showLeadSource={false}
          showStatus={false}
          staffLocationLabel={user?.location_name}
          staffLocationOnly={user?.role === "staff"}
        />
      </div>

      {error && <p className="home-state home-state--error">{error}</p>}
      {isLoading && <p className="home-state">Loading tours...</p>}

      <div className="home-summary" aria-label="Today tour summary">
        <TourList
          title="Today's Booked Tours"
          tours={bookedTours}
          tone="booked"
        />
        <TourList
          title="Yesterday's No Shows"
          tours={noShowTours}
          tone="noshow"
        />
      </div>

      <ActionNeededInfo
        isLoading={isPendingLoading}
        pendingTourOutcome={pendingSummary.pendingTourOutcome}
        pendingEnrollmentOutcome={pendingSummary.pendingEnrollmentOutcome}
      />

      <div className="home-fixed-action">
        <Button size="lg" onClick={() => navigate("/tours/new")}>
          + New Tour
        </Button>
      </div>
    </section>
  );
}

export default Home;
