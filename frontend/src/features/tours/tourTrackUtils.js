import { getTourEvents, listTours } from "./tourApi";
import {
  addApplicationCalendarDays,
  applicationTodayValue,
  differenceInApplicationCalendarDays,
  toApplicationDateInput,
} from "../../utils/timeZone";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOUR_OUTCOME_STATUSES = ["scheduled"];

export function parseTourTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getTourDate(tour) {
  return parseTourTimestamp(tour?.scheduled_tour_date || tour?.tour_date || tour?.date);
}

export function getFirstEventDate(tour, status) {
  const dates = (tour?.events || [])
    .filter((event) => event.status === status)
    .map((event) => parseTourTimestamp(event.event_timestamp))
    .filter(Boolean)
    .sort((firstDate, secondDate) => firstDate - secondDate);

  return dates[0] || null;
}

export function getAverageDaysToEnroll(tours) {
  const durations = tours
    .map((tour) => {
      const tourDate = getTourDate(tour);
      const enrolledDate = getFirstEventDate(tour, "enrolled");
      if (!tourDate || !enrolledDate) return null;
      return Math.max(0, (enrolledDate - tourDate) / DAY_MS);
    })
    .filter((value) => value !== null);

  if (!durations.length) return null;

  const total = durations.reduce((sum, value) => sum + value, 0);
  return Math.round((total / durations.length) * 10) / 10;
}

export async function attachEventsToTours(tours) {
  const eventResults = await Promise.all(
    tours.map(async (tour) => {
      try {
        const events = await getTourEvents(tour.id);
        return [tour.id, Array.isArray(events) ? events : []];
      } catch {
        return [tour.id, []];
      }
    }),
  );
  const eventsByTourId = new Map(eventResults);

  return tours.map((tour) => ({
    ...tour,
    events: eventsByTourId.get(tour.id) || [],
  }));
}

export async function loadAverageDaysToEnroll(params = {}) {
  const data = await listTours({
    ...params,
    status: "enrolled",
  });
  const tours = Array.isArray(data) ? data : data.results || [];
  const toursWithEvents = await attachEventsToTours(tours);
  return getAverageDaysToEnroll(toursWithEvents);
}

export function formatAverageDays(value) {
  if (value === null || value === undefined) return "not enough data";
  return `${value} day${value === 1 ? "" : "s"}`;
}

function pluralizeDays(value) {
  return `${value} day${value === 1 ? "" : "s"}`;
}

export function getTourTrackInfo(tour, averageDaysToEnroll) {
  const status = tour?.current_status;
  const tourDate = toApplicationDateInput(getTourDate(tour));
  const today = applicationTodayValue();

  if (TOUR_OUTCOME_STATUSES.includes(status) && tourDate && today && tourDate < today) {
    const daysPast = Math.max(1, differenceInApplicationCalendarDays(today, tourDate));
    return {
      category: "off_track",
      daysPast,
      label: `${pluralizeDays(daysPast)} past tour date`,
      shortLabel: `${daysPast}d past tour`,
      type: "tour_outcome",
    };
  }

  if (status === "toured" && Number.isFinite(averageDaysToEnroll)) {
    const dueDate = tourDate
      ? addApplicationCalendarDays(tourDate, Math.ceil(averageDaysToEnroll))
      : null;
    if (dueDate && today) {
      const daysPast = differenceInApplicationCalendarDays(today, dueDate);
      if (daysPast >= 1) {
        return {
          category: "off_track",
          daysPast,
          label: `${pluralizeDays(daysPast)} past avg enrollment time`,
          shortLabel: `${daysPast}d past avg`,
          type: "enrollment_outcome",
        };
      }
    }
  }

  return {
    category: "on_track",
    daysPast: 0,
    label: "",
    shortLabel: "",
    type: "",
  };
}

export function filterToursByTrackCategory(tours, categories, averageDaysToEnroll) {
  if (!categories?.length || categories.length === 2) return tours;

  return tours.filter((tour) => (
    categories.includes(getTourTrackInfo(tour, averageDaysToEnroll).category)
  ));
}
