export const statusOptions = [
  { value: "scheduled", label: "Booked" },
  { value: "toured", label: "Toured" },
  { value: "no_show", label: "No Show" },
  { value: "enrolled", label: "Enrolled" },
  { value: "churned", label: "Churned" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "cancelled", label: "Cancelled" },
];

export const statusLabels = {
  scheduled: "Booked",
  rescheduled: "Rescheduled",
  toured: "Toured",
  enrolled: "Enrolled",
  churned: "Churned",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export const datePresetOptions = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom range" },
];

export const defaultDatePreset = "last_30_days";

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  return {
    dateFrom: toDateInputValue(firstDay),
    dateTo: toDateInputValue(lastDay),
  };
}

function getYearRange(yearValue) {
  return {
    dateFrom: `${yearValue}-01-01`,
    dateTo: `${yearValue}-12-31`,
  };
}

export function todayValue() {
  return toDateInputValue(new Date());
}

export function currentMonthValue() {
  return todayValue().slice(0, 7);
}

export function currentYearValue() {
  return todayValue().slice(0, 4);
}

export function getDateRange(filters) {
  const today = new Date();

  switch (filters.datePreset) {
    case "today":
      return { dateFrom: todayValue(), dateTo: todayValue() };
    case "yesterday": {
      const value = toDateInputValue(addDays(today, -1));
      return { dateFrom: value, dateTo: value };
    }
    case "tomorrow": {
      const value = toDateInputValue(addDays(today, 1));
      return { dateFrom: value, dateTo: value };
    }
    case "last_7_days":
      return { dateFrom: toDateInputValue(addDays(today, -6)), dateTo: todayValue() };
    case "last_30_days":
      return { dateFrom: toDateInputValue(addDays(today, -29)), dateTo: todayValue() };
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
    month: currentMonthValue(),
    year: currentYearValue(),
    locations: user?.role === "staff" && user.location ? [String(user.location)] : [],
    leadSources: [],
    statuses: [],
    search: "",
    ...overrides,
  };
}
