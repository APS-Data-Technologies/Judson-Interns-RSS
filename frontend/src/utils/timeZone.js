export const APPLICATION_TIME_ZONE = "America/Chicago";
export const APPLICATION_TIME_ZONE_LABEL = "Central Time";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APPLICATION_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const inputFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APPLICATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function getInputParts(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(
    inputFormatter.formatToParts(date).map(({ type, value: partValue }) => [type, partValue]),
  );
}

export function formatApplicationDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateTimeFormatter.format(date);
}

export function toApplicationDateInput(value) {
  const parts = getInputParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

export function toApplicationTimeInput(value) {
  const parts = getInputParts(value);
  return parts ? `${parts.hour}:${parts.minute}` : "";
}

// The API interprets timezone-less tour form values in settings.TIME_ZONE.
export function buildApplicationDateTime(date, time) {
  return `${date}T${time}:00`;
}

export function applicationTodayValue() {
  return toApplicationDateInput(new Date());
}

export function addApplicationCalendarDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function differenceInApplicationCalendarDays(laterValue, earlierValue) {
  const later = Date.parse(`${laterValue}T00:00:00Z`);
  const earlier = Date.parse(`${earlierValue}T00:00:00Z`);
  return Math.round((later - earlier) / (24 * 60 * 60 * 1000));
}
