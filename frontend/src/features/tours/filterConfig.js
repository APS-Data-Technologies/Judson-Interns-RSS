import {
  addApplicationCalendarDays,
  applicationTodayValue,
} from "../../utils/timeZone";

export const statusOptions = [
  { value: "scheduled", label: "Booked" },
  { value: "toured", label: "Toured" },
  { value: "no_show", label: "No Show" },
  { value: "enrolled", label: "Enrolled" },
  { value: "churned", label: "Churned" },
];

export const statusLabels = {
  scheduled: "Booked",
  toured: "Toured",
  enrolled: "Enrolled",
  churned: "Churned",
  no_show: "No Show",
};

export const categoryOptions = [
  { value: "on_track", label: "On track" },
  { value: "off_track", label: "Off track tours" },
];

export const datePresetOptions = [
  { value: "all_time", label: "All Time" },
  { value: "month_to_date", label: "MTD" },
  { value: "year_to_date", label: "YTD" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_n_days", label: "Last custom days" },
  { value: "next_n_days", label: "Next custom days" },
  { value: "custom", label: "Custom date" },
];

export const defaultDatePreset = "last_30_days";

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    dateFrom: `${year}-${String(month).padStart(2, "0")}-01`,
    dateTo: addApplicationCalendarDays(nextMonth, -1),
  };
}

function getYearRange(yearValue) {
  return {
    dateFrom: `${yearValue}-01-01`,
    dateTo: `${yearValue}-12-31`,
  };
}

function normalizedDayCount(value) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) return 7;
  return Math.min(Math.max(parsedValue, 1), 3650);
}

export function todayValue() {
  return applicationTodayValue();
}

export function currentMonthValue() {
  return todayValue().slice(0, 7);
}

export function currentYearValue() {
  return todayValue().slice(0, 4);
}

export function getDateRange(filters) {
  const today = todayValue();
  const [year, month] = today.split("-");

  switch (filters.datePreset) {
    case "all_time":
      return { dateFrom: "", dateTo: "" };
    case "today":
      return { dateFrom: todayValue(), dateTo: todayValue() };
    case "month_to_date":
      return {
        dateFrom: `${year}-${month}-01`,
        dateTo: today,
      };
    case "year_to_date":
      return {
        dateFrom: `${year}-01-01`,
        dateTo: today,
      };
    case "yesterday": {
      const value = addApplicationCalendarDays(today, -1);
      return { dateFrom: value, dateTo: value };
    }
    case "tomorrow": {
      const value = addApplicationCalendarDays(today, 1);
      return { dateFrom: value, dateTo: value };
    }
    case "last_7_days":
      return { dateFrom: addApplicationCalendarDays(today, -6), dateTo: today };
    case "last_30_days":
      return { dateFrom: addApplicationCalendarDays(today, -29), dateTo: today };
    case "last_n_days": {
      const dayCount = normalizedDayCount(filters.lastDays);
      return { dateFrom: addApplicationCalendarDays(today, -(dayCount - 1)), dateTo: today };
    }
    case "next_n_days": {
      const dayCount = normalizedDayCount(filters.nextDays);
      return { dateFrom: today, dateTo: addApplicationCalendarDays(today, dayCount - 1) };
    }
    case "month":
      return getMonthRange(filters.month || currentMonthValue());
    case "year":
      return getYearRange(filters.year || currentYearValue());
    case "custom":
      return { dateFrom: filters.dateFrom || "", dateTo: filters.dateTo || "" };
    default:
      return { dateFrom: "", dateTo: "" };
  }
}

export function joinFilterValues(values) {
  return values.length ? values.join(",") : undefined;
}

export function createDefaultTourFilters(user, overrides = {}) {
  return {
    datePreset: defaultDatePreset,
    dateFrom: "",
    dateTo: "",
    lastDays: 7,
    nextDays: 7,
    month: currentMonthValue(),
    year: currentYearValue(),
    locations: user?.role === "staff" && user.location ? [String(user.location)] : [],
    leadSources: [],
    staff: [],
    statuses: [],
    categories: [],
    search: "",
    ...overrides,
  };
}
