import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  ChevronLeft,
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Info,
  MapPin,
  Megaphone,
  CircleDollarSign,
  UsersRound,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Infinity as InfinityIcon,
  Star,
} from "lucide-react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import useAuth from "../../features/auth/useAuth";
import { getCohortAnalytics } from "../../features/analytics/analyticsApi";
import { toTitleCaseWords } from "../../utils/displayText";
import {
  createDefaultTourFilters,
  getDateRange,
  joinFilterValues,
} from "../../features/tours/filterConfig";
import { getLeadSources, getLocations, getTourEvents, listTours } from "../../features/tours/tourApi";
import "./Analytics.css";

const analyticsStatuses = [
  { status: "scheduled", label: "Booked" },
  { status: "toured", label: "Toured" },
  { status: "no_show", label: "No Show" },
  { status: "enrolled", label: "Enrolled" },
  { status: "churned", label: "Churned" },
];

const emptyCounts = analyticsStatuses.reduce((summary, item) => ({
  ...summary,
  [item.status]: 0,
}), {});

const rankingSortOptions = [
  { value: "best", label: "Best performing" },
  { value: "worst", label: "Least performing" },
];

const rankingMetricOptions = [
  { value: "enrollment", label: "Enrollments" },
  { value: "conversion", label: "Conversion rate" },
  { value: "average_days", label: "Average days to Enrollment" },
  { value: "toured", label: "Toured rate" },
  { value: "close", label: "Closed rate" },
];

const volumePerformanceStatusOptions = [
  { value: "all", label: "All" },
  { value: "booked", label: "Booked" },
  { value: "toured", label: "Toured" },
  { value: "noShow", label: "No Show" },
  { value: "enrolled", label: "Enrolled" },
  { value: "churned", label: "Churned" },
];

const trendModeOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function parseDateInput(value) {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

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

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function getPreviousMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const previousMonthStart = new Date(year, month - 2, 1);
  const previousMonthEnd = new Date(year, month - 1, 0);
  return {
    dateFrom: toDateInputValue(previousMonthStart),
    dateTo: toDateInputValue(previousMonthEnd),
  };
}

function getPreviousYearRange(yearValue) {
  const previousYear = Number(yearValue) - 1;
  if (!previousYear) {
    return null;
  }
  return {
    dateFrom: `${previousYear}-01-01`,
    dateTo: `${previousYear}-12-31`,
  };
}

function getPreviousComparableRange(filters, selectedRange) {
  if (!selectedRange.dateFrom || !selectedRange.dateTo) {
    return null;
  }

  if (filters.datePreset === "month" && filters.month) {
    return getPreviousMonthRange(filters.month);
  }

  if (filters.datePreset === "year" && filters.year) {
    return getPreviousYearRange(filters.year);
  }

  const selectedStart = parseDateInput(selectedRange.dateFrom);
  const selectedEnd = parseDateInput(selectedRange.dateTo);
  if (!selectedStart || !selectedEnd || selectedEnd < selectedStart) {
    return null;
  }

  const selectedDays = Math.round((selectedEnd - selectedStart) / 86400000) + 1;
  const previousEnd = addDays(selectedStart, -1);
  const previousStart = addDays(previousEnd, -(selectedDays - 1));

  return {
    dateFrom: toDateInputValue(previousStart),
    dateTo: toDateInputValue(previousEnd),
  };
}

function formatDisplayDate(value) {
  const date = parseDateInput(value);
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDisplayRange(range) {
  if (!range?.dateFrom || !range?.dateTo) {
    return "Selected period";
  }
  if (range.dateFrom === range.dateTo) {
    return formatDisplayDate(range.dateFrom);
  }
  return `${formatDisplayDate(range.dateFrom)} to ${formatDisplayDate(range.dateTo)}`;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTourDate(tour) {
  const value = tour.scheduled_tour_date || tour.tour_date || tour.date;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDateInput(value);
  }
  return parseTimestamp(value);
}

function getFirstEventDate(tour, status) {
  const matchingDates = (tour.events || [])
    .filter((event) => event.status === status)
    .map((event) => parseTimestamp(event.event_timestamp))
    .filter(Boolean)
    .sort((firstDate, secondDate) => firstDate - secondDate);
  return matchingDates[0] || null;
}

function getTourField(tour, keys, fallback = "Unknown") {
  const value = keys
    .map((key) => tour[key])
    .find((item) => item !== undefined && item !== null && String(item).trim() !== "");
  return value === undefined || value === null ? fallback : String(value);
}

function getNumberField(tour, keys) {
  const value = keys
    .map((key) => tour[key])
    .find((item) => item !== undefined && item !== null && item !== "");
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function hasReachedStatus(tour, status) {
  const eventStatuses = new Set((tour.events || []).map((event) => event.status));

  if (status === "scheduled") {
    return true;
  }

  if (status === "toured") {
    return (
      eventStatuses.has("toured") ||
      ["toured", "enrolled", "churned"].includes(tour.current_status)
    );
  }

  return eventStatuses.has(status) || tour.current_status === status;
}

function getMetricDate(tour, status) {
  if (status === "scheduled") {
    return getTourDate(tour);
  }
  return getFirstEventDate(tour, status);
}

function countCohortProgress(tours) {
  return tours.reduce((summary, tour) => ({
    ...summary,
    scheduled: summary.scheduled + 1,
    toured: summary.toured + (hasReachedStatus(tour, "toured") ? 1 : 0),
    no_show: summary.no_show + (hasReachedStatus(tour, "no_show") ? 1 : 0),
    enrolled: summary.enrolled + (hasReachedStatus(tour, "enrolled") ? 1 : 0),
    churned: summary.churned + (hasReachedStatus(tour, "churned") ? 1 : 0),
  }), { ...emptyCounts });
}

const progressDayBuckets = [
  { label: "0–7 days", minimum: 0, maximum: 7 },
  { label: "8–14 days", minimum: 8, maximum: 14 },
  { label: "15–30 days", minimum: 15, maximum: 30 },
  { label: "31–60 days", minimum: 31, maximum: 60 },
  { label: "60+ days", minimum: 61, maximum: Infinity },
];
const shortProgressDayBuckets = [
  { label: "0–2 days", minimum: 0, maximum: 2 },
  { label: "3–5 days", minimum: 3, maximum: 5 },
  { label: "6–10 days", minimum: 6, maximum: 10 },
  { label: "11–20 days", minimum: 11, maximum: 20 },
  { label: "21+ days", minimum: 21, maximum: Infinity },
];

function getProgressDayBuckets(filters) {
  const range = getDateRange(filters);
  const start = parseDateInput(range.dateFrom);
  const end = parseDateInput(range.dateTo);
  if (!start || !end) return progressDayBuckets;
  const inclusiveDays = Math.floor((end - start) / 86400000) + 1;
  return inclusiveDays < 20 ? shortProgressDayBuckets : progressDayBuckets;
}

function buildTimeToProgress(tours, previousTours = null, buckets = progressDayBuckets) {
  const transitions = [
    { key: "booked_to_toured", label: "Booked → Toured", source: "booked", destination: "toured" },
    { key: "booked_to_no_show", label: "Booked → No Show", source: "booked", destination: "no_show" },
    { key: "toured_to_enrolled", label: "Toured → Enrolled", source: "toured", destination: "enrolled" },
    { key: "toured_to_churned", label: "Toured → Churned", source: "toured", destination: "churned" },
    { key: "booked_to_enrolled", label: "Booked → Enrolled", source: "tour_date", destination: "enrolled" },
  ];
  return transitions.map((transition) => {
    const counts = buckets.map(() => 0);
    const elapsedValues = [];
    const eligible = ["booked", "tour_date"].includes(transition.source) ? tours.length : tours.filter((tour) => hasReachedStatus(tour, "toured")).length;
    tours.forEach((tour) => {
      const source = transition.source === "booked" ? parseTimestamp(tour.created_at) : transition.source === "tour_date" ? getTourDate(tour) : getMetricDate(tour, transition.source);
      const destination = getMetricDate(tour, transition.destination);
      if (!source || !destination || destination < source) return;
      const elapsedDays = Math.floor((destination - source) / 86400000);
      elapsedValues.push(elapsedDays);
      const bucketIndex = buckets.findIndex((bucket) => elapsedDays >= bucket.minimum && elapsedDays <= bucket.maximum);
      if (bucketIndex >= 0) counts[bucketIndex] += 1;
    });
    const total = counts.reduce((sum, count) => sum + count, 0);
    return { ...transition, total, eligible, pending: Math.max(eligible - total, 0), averageDays: elapsedValues.length ? Math.round((elapsedValues.reduce((sum, value) => sum + value, 0) / elapsedValues.length) * 10) / 10 : null, buckets: buckets.map((bucket, index) => ({ label: bucket.label, count: counts[index], percent: total ? Math.round((counts[index] / total) * 1000) / 10 : 0 })) };
  }).map((transition) => {
    if (!previousTours) return transition;
    const previous = buildTimeToProgress(previousTours, null, buckets).find((item) => item.key === transition.key);
    return { ...transition, previousAverageDays: previous?.averageDays ?? null, averageDelta: transition.averageDays !== null && previous?.averageDays != null ? Math.round((transition.averageDays - previous.averageDays) * 10) / 10 : null };
  });
}

function getChartRange(filters, tours) {
  const filterRange = getDateRange(filters);
  if (filterRange.dateFrom && filterRange.dateTo) {
    return filterRange;
  }

  const tourDates = tours.map(getTourDate).filter(Boolean).sort((firstDate, secondDate) => firstDate - secondDate);
  if (!tourDates.length) {
    const today = new Date();
    return {
      dateFrom: toDateInputValue(addDays(today, -6)),
      dateTo: toDateInputValue(today),
    };
  }

  return {
    dateFrom: toDateInputValue(tourDates[0]),
    dateTo: toDateInputValue(tourDates[tourDates.length - 1]),
  };
}

function getDateKeys(range) {
  const start = parseDateInput(range.dateFrom);
  const end = parseDateInput(range.dateTo);
  if (!start || !end || end < start) {
    return [];
  }

  const keys = [];
  let currentDate = new Date(start);
  while (currentDate <= end && keys.length < 45) {
    keys.push(toDateInputValue(currentDate));
    currentDate = addDays(currentDate, 1);
  }
  return keys;
}

function getTrendData(tours, filters) {
  const range = getChartRange(filters, tours);
  const keys = getDateKeys(range);
  if (!keys.length) {
    return [];
  }

  const keySet = new Set(keys);
  const buckets = new Map(keys.map((key) => [key, {
    date: key,
    booked: 0,
    toured: 0,
    enrolled: 0,
    conversion: null,
  }]));

  tours.forEach((tour) => {
    [
      ["scheduled", "booked"],
      ["toured", "toured"],
      ["enrolled", "enrolled"],
    ].forEach(([status, field]) => {
      if (!hasReachedStatus(tour, status)) {
        return;
      }
      const date = getMetricDate(tour, status);
      if (!date) {
        return;
      }
      const key = toDateInputValue(date);
      if (keySet.has(key)) {
        buckets.get(key)[field] += 1;
      }
    });
  });

  return keys.map((key) => {
    const bucket = buckets.get(key);
    return {
      ...bucket,
      conversion: getPercent(bucket.enrolled, bucket.toured),
    };
  });
}

function getCohortRateTrendData(tours, filters) {
  const range = getChartRange(filters, tours);
  const keys = getDateKeys(range);
  const buckets = new Map(keys.map((key) => [key, { date: key, label: formatDisplayDate(key), booked: 0, toured: 0, noShow: 0, enrolled: 0, churned: 0, averageDaysCount: 0, averageDaysTotal: 0 }]));
  tours.forEach((tour) => {
    const key = toDateInputValue(getTourDate(tour));
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.booked += 1;
    bucket.toured += hasReachedStatus(tour, "toured") ? 1 : 0;
    bucket.noShow += hasReachedStatus(tour, "no_show") ? 1 : 0;
    bucket.enrolled += hasReachedStatus(tour, "enrolled") ? 1 : 0;
    bucket.churned += hasReachedStatus(tour, "churned") ? 1 : 0;
    const enrolledDate = getFirstEventDate(tour, "enrolled");
    const tourDate = getTourDate(tour);
    if (enrolledDate && tourDate) {
      bucket.averageDaysCount += 1;
      bucket.averageDaysTotal += Math.max(0, (enrolledDate - tourDate) / 86400000);
    }
  });
  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    averageDaysToEnroll: bucket.averageDaysCount ? Math.round((bucket.averageDaysTotal / bucket.averageDaysCount) * 10) / 10 : null,
  }));
}

function getRankingMetricValue(item, metric) {
  if (metric === "conversion") {
    return getPercent(item.enrolled, item.toured);
  }
  if (metric === "close") {
    return getPercent(item.enrolled + item.churned, item.toured);
  }
  if (metric === "toured") {
    return getPercent(item.toured, item.booked);
  }
  if (metric === "margin") {
    if (!item.revenue) {
      return null;
    }
    return Math.round(((item.revenue - item.cost) / item.revenue) * 100);
  }
  if (metric === "enrollment") {
    return item.enrolled;
  }
  if (metric === "average_days") {
    if (!item.enrollmentDurationCount) {
      return null;
    }
    return Math.round((item.enrollmentDurationTotal / item.enrollmentDurationCount) * 10) / 10;
  }
  return null;
}

function getRankingDetail(item, metric) {
  if (metric === "conversion") {
    return `${item.enrolled} enrolled / ${item.toured} toured`;
  }
  if (metric === "close") {
    return `${item.enrolled + item.churned} closed / ${item.toured} toured`;
  }
  if (metric === "toured") {
    return `${item.toured} toured / ${item.booked} booked`;
  }
  if (metric === "margin") {
    if (!item.revenue) {
      return "Revenue and cost data not available";
    }
    return `$${Math.round(item.revenue - item.cost).toLocaleString()} margin / $${Math.round(item.revenue).toLocaleString()} revenue`;
  }
  if (metric === "enrollment") {
    return `${item.enrolled} enrollment${item.enrolled === 1 ? "" : "s"}`;
  }
  if (metric === "average_days") {
    if (!item.enrollmentDurationCount) {
      return "No enrolled tours in this period";
    }
    return `${item.enrollmentDurationCount} enrolled tour${item.enrollmentDurationCount === 1 ? "" : "s"}`;
  }
  return "";
}

function buildRanking(tours, groupKeys, metric) {
  const groups = new Map();

  tours.forEach((tour) => {
    const name = getTourField(tour, groupKeys);
    const current = groups.get(name) || {
      name,
      booked: 0,
      toured: 0,
      enrolled: 0,
      churned: 0,
      enrollmentDurationCount: 0,
      enrollmentDurationTotal: 0,
      revenue: 0,
      cost: 0,
      metric,
      value: null,
      detail: "",
    };
    const revenue = getNumberField(tour, ["revenue", "tuition", "amount", "price", "fee_amount", "enrollment_revenue"]);
    const cost = getNumberField(tour, ["cost", "cost_amount", "marketing_cost", "acquisition_cost", "lead_cost"]);

    current.booked += 1;
    current.toured += hasReachedStatus(tour, "toured") ? 1 : 0;
    current.enrolled += hasReachedStatus(tour, "enrolled") ? 1 : 0;
    current.churned += hasReachedStatus(tour, "churned") ? 1 : 0;
    const tourDate = getTourDate(tour);
    const enrolledDate = getFirstEventDate(tour, "enrolled");
    if (tourDate && enrolledDate) {
      current.enrollmentDurationCount += 1;
      current.enrollmentDurationTotal += Math.max(0, (enrolledDate - tourDate) / 86400000);
    }
    current.revenue += revenue ?? 0;
    current.cost += cost ?? 0;
    current.metric = metric;
    current.value = getRankingMetricValue(current, metric);
    current.detail = getRankingDetail(current, metric);
    groups.set(name, current);
  });

  return Array.from(groups.values());
}

function buildLocalVolumePerformanceRanking(tours, filters, groupKeys) {
  const groups = new Map();
  tours.forEach((tour) => {
    const name = getTourField(tour, groupKeys);
    const group = groups.get(name) || [];
    group.push(tour);
    groups.set(name, group);
  });
  return Array.from(groups, ([name, groupTours]) => {
    const totals = getTrendData(groupTours, filters).reduce((sum, row) => ({
      booked: sum.booked + Number(row.booked || 0),
      toured: sum.toured + Number(row.toured || 0),
      noShow: sum.noShow + Number(row.noShow || 0),
      enrolled: sum.enrolled + Number(row.enrolled || 0),
      churned: sum.churned + Number(row.churned || 0),
    }), { booked: 0, toured: 0, noShow: 0, enrolled: 0, churned: 0 });
    return { name, ...totals, all: Object.values(totals).reduce((sum, value) => sum + value, 0) };
  });
}

function sortRanking(items, sortDirection) {
  return [...items].sort((first, second) => {
    const firstHasValue = first.value !== null;
    const secondHasValue = second.value !== null;

    if (firstHasValue !== secondHasValue) {
      return firstHasValue ? -1 : 1;
    }

    const firstValue = first.value ?? -1;
    const secondValue = second.value ?? -1;
    if (firstValue !== secondValue) {
      const smallerIsBetter = first.metric === "average_days" || second.metric === "average_days";
      if (smallerIsBetter) {
        return sortDirection === "worst"
          ? secondValue - firstValue
          : firstValue - secondValue;
      }
      return sortDirection === "worst"
        ? firstValue - secondValue
        : secondValue - firstValue;
    }

    if (second.enrolled !== first.enrolled) {
      return second.enrolled - first.enrolled;
    }
    return second.toured - first.toured;
  });
}

function countPendingOutcomes(tours) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return tours.reduce((summary, tour) => {
    const tourDate = getTourDate(tour);
    const tourDateOnly = tourDate ? new Date(tourDate) : null;
    if (tourDateOnly) {
      tourDateOnly.setHours(0, 0, 0, 0);
    }

    const isPastTour = tourDateOnly && tourDateOnly < today;
    const needsTourOutcome = isPastTour
      && !hasReachedStatus(tour, "toured")
      && !hasReachedStatus(tour, "no_show");
    const needsFinalOutcome = hasReachedStatus(tour, "toured")
      && !hasReachedStatus(tour, "enrolled")
      && !hasReachedStatus(tour, "churned");

    return {
      pendingTourOutcome: summary.pendingTourOutcome + (needsTourOutcome ? 1 : 0),
      pendingEnrollmentOutcome: summary.pendingEnrollmentOutcome + (needsFinalOutcome ? 1 : 0),
    };
  }, {
    pendingTourOutcome: 0,
    pendingEnrollmentOutcome: 0,
  });
}

function getAverageDaysToEnroll(tours) {
  const enrollmentDurations = tours
    .map((tour) => {
      const tourDate = getTourDate(tour);
      const enrolledDate = getFirstEventDate(tour, "enrolled");
      if (!tourDate || !enrolledDate) {
        return null;
      }
      return Math.max(0, (enrolledDate - tourDate) / 86400000);
    })
    .filter((value) => value !== null);

  if (!enrollmentDurations.length) {
    return null;
  }

  const totalDays = enrollmentDurations.reduce((total, value) => total + value, 0);
  return Math.round((totalDays / enrollmentDurations.length) * 10) / 10;
}

async function attachEventsToTours(tourData) {
  const tours = Array.isArray(tourData) ? tourData : tourData.results || [];
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

async function fetchLocalAnalyticsTours(filters) {
  const dateRange = getDateRange(filters);
  const previousDateRange = getPreviousComparableRange(filters, dateRange);
  const commonParams = {
    location: joinFilterValues(filters.locations),
    lead_source: joinFilterValues(filters.leadSources),
    staff: joinFilterValues(filters.staff || []),
    status: joinFilterValues(filters.statuses),
  };

  const [tourData, previousTourData] = await Promise.all([
    listTours({
      ...commonParams,
      date_from: dateRange.dateFrom || undefined,
      date_to: dateRange.dateTo || undefined,
    }),
    previousDateRange
      ? listTours({
          ...commonParams,
          date_from: previousDateRange.dateFrom,
          date_to: previousDateRange.dateTo,
        })
      : Promise.resolve([]),
  ]);

  const [cohortTours, previousCohortTours] = await Promise.all([
    attachEventsToTours(tourData),
    attachEventsToTours(previousTourData),
  ]);

  return { cohortTours, previousCohortTours };
}

function getPercent(numerator, denominator) {
  if (!denominator) {
    return null;
  }
  return Math.round((numerator / denominator) * 100);
}

function getRateDelta(currentValue, previousValue, canCompare) {
  if (!canCompare || currentValue === null || previousValue === null) {
    return null;
  }
  return currentValue - previousValue;
}

function getDelta(currentValue, previousValue, canCompare) {
  if (!canCompare || previousValue === undefined || previousValue === null) {
    return null;
  }
  const difference = currentValue - previousValue;
  const percent = previousValue ? Math.round((difference / previousValue) * 100) : null;
  return { difference, percent };
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeRateValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getBackendMetricName(metric) {
  if (metric === "enrollment") {
    return "enrollments";
  }
  if (metric === "margin") {
    return "contribution_margin";
  }
  return metric;
}

function getBackendRankingSort(sortDirection) {
  return sortDirection === "worst" ? "least" : "best";
}

function buildAnalyticsParams(filters, rankingMetric, rankingSort) {
  const dateRange = getDateRange(filters);
  return {
    date_from: dateRange.dateFrom || undefined,
    date_to: dateRange.dateTo || undefined,
    location: joinFilterValues(filters.locations),
    lead_source: joinFilterValues(filters.leadSources),
    staff: joinFilterValues(filters.staff || []),
    status: joinFilterValues(filters.statuses),
    search: filters.search || undefined,
    category: joinFilterValues(filters.categories),
    metric: getBackendMetricName(rankingMetric),
    ranking_metric: getBackendMetricName(rankingMetric),
    ranking_sort: getBackendRankingSort(rankingSort),
  };
}

function normalizeBackendCounts(counts = {}) {
  return analyticsStatuses.reduce((summary, { status }) => ({
    ...summary,
    [status]: safeNumber(counts[status]),
  }), {});
}

function adaptBackendRankingItem(item, metric) {
  const normalized = {
    ...item,
    name: item.name || "Unassigned",
    booked: safeNumber(item.booked ?? item.scheduled),
    toured: safeNumber(item.toured),
    enrolled: safeNumber(item.enrolled),
    churned: safeNumber(item.churned),
    noShow: safeNumber(item.noShow ?? item.no_show),
    enrollmentDurationCount: safeNumber(item.enrollmentDurationCount),
    enrollmentDurationTotal: safeNumber(item.enrollmentDurationTotal),
    revenue: safeNumber(item.revenue),
    cost: safeNumber(item.cost),
    metric,
    value: normalizeRateValue(item.value),
  };
  return {
    ...normalized,
    detail: item.detail || getRankingDetail(normalized, metric),
  };
}

function adaptBackendTrendRow(row) {
  return {
    ...row,
    date: row.date,
    label: row.label || row.date,
    booked: safeNumber(row.booked),
    toured: safeNumber(row.toured),
    enrolled: safeNumber(row.enrolled),
    noShow: safeNumber(row.noShow ?? row.no_show),
    churned: safeNumber(row.churned),
    touredRate: normalizeRateValue(row.touredRate ?? row.toured_rate),
    noShowRate: normalizeRateValue(row.noShowRate ?? row.no_show_rate),
    closeRate: normalizeRateValue(row.closeRate ?? row.close_rate),
    conversionRate: normalizeRateValue(row.conversionRate ?? row.conversion_rate),
    averageDaysToEnroll: row.averageDaysToEnroll ?? row.average_days_to_enroll ?? null,
    averageDaysCount: safeNumber(row.averageDaysCount ?? row.average_days_count),
    conversion: normalizeRateValue(row.conversion ?? row.conversionRate),
  };
}

function adaptBackendCohortAnalytics(data, rankingMetric) {
  const counts = normalizeBackendCounts(data.counts);
  const volumeCounts = normalizeBackendCounts(data.volumeCounts || data.counts);
  const previousCounts = normalizeBackendCounts(data.previousCounts);
  const previousVolumeCounts = normalizeBackendCounts(data.previousVolumeCounts || data.previousCounts);
  const deltas = data.deltas || {};
  const volumeDeltas = data.volumeDeltas || deltas;
  const rates = data.rates || {};
  const rateDeltas = data.rateDeltas || {};
  const pendingCounts = data.pendingCounts || {};
  const hasPreviousData = Object.values(previousCounts).some((value) => value > 0);

  return {
    rankings: {
      locations: (data.rankings?.locations || []).map((item) => adaptBackendRankingItem(item, rankingMetric)),
      leadSources: (data.rankings?.leadSources || data.rankings?.lead_sources || []).map((item) => (
        adaptBackendRankingItem(item, rankingMetric)
      )),
      staff: (data.rankings?.staff || []).map((item) => adaptBackendRankingItem(item, rankingMetric)),
    },
    allTimeRankings: {
      locations: (data.allTimeRankings?.locations || data.rankings?.locations || []).map((item) => adaptBackendRankingItem(item, rankingMetric)),
      leadSources: (data.allTimeRankings?.leadSources || data.allTimeRankings?.lead_sources || data.rankings?.leadSources || []).map((item) => adaptBackendRankingItem(item, rankingMetric)),
      staff: (data.allTimeRankings?.staff || data.rankings?.staff || []).map((item) => adaptBackendRankingItem(item, rankingMetric)),
    },
    volumePerformanceRankings: {
      locations: data.volumePerformanceRankings?.locations || [],
      leadSources: data.volumePerformanceRankings?.leadSources || data.volumePerformanceRankings?.lead_sources || [],
      staff: data.volumePerformanceRankings?.staff || [],
    },
    allTimeVolumePerformanceRankings: {
      locations: data.allTimeVolumePerformanceRankings?.locations || [],
      leadSources: data.allTimeVolumePerformanceRankings?.leadSources || data.allTimeVolumePerformanceRankings?.lead_sources || [],
      staff: data.allTimeVolumePerformanceRankings?.staff || [],
    },
    staffOptions: data.staffOptions || [],
    trendData: (data.trendData || []).map(adaptBackendTrendRow),
    allTimeTrendData: (data.allTimeTrendData || data.trendData || []).map(adaptBackendTrendRow),
    timeToProgress: data.timeToProgress || [],
    volumeTrendData: data.volumeTrendData || data.trendData || [],
    previousVolumeTrendData: data.previousVolumeTrendData || [],
    volumeHeatmap: data.volumeHeatmap || [],
    volumeCalendarData: data.volumeCalendarData || [],
    allTimeVolumeCalendarData: data.allTimeVolumeCalendarData || data.volumeCalendarData || [],
    metrics: analyticsStatuses.map(({ status, label }) => ({
      label,
      value: counts[status] || 0,
      delta: deltas[status] || getDelta(counts[status] || 0, previousCounts[status] || 0, hasPreviousData),
      status,
    })),
    volumeMetrics: analyticsStatuses.map(({ status, label }) => ({
      label,
      value: volumeCounts[status] || 0,
      previousValue: previousVolumeCounts[status] || 0,
      delta: volumeDeltas[status] || null,
      status,
    })),
    pendingOutcomes: {
      pendingTourOutcome: safeNumber(pendingCounts.pendingTourOutcome),
      pendingEnrollmentOutcome: safeNumber(pendingCounts.pendingEnrollmentOutcome),
    },
    averageDaysToEnroll:
      data.averageDaysToEnroll === null || data.averageDaysToEnroll === undefined
        ? null
        : safeNumber(data.averageDaysToEnroll, null),
    rates: {
      toured: normalizeRateValue(rates.toured),
      no_show: normalizeRateValue(rates.no_show ?? rates.noShow),
      close: normalizeRateValue(rates.close),
      conversion: normalizeRateValue(rates.conversion),
    },
    rateDeltas: {
      toured: normalizeRateValue(rateDeltas.toured),
      no_show: normalizeRateValue(rateDeltas.no_show ?? rateDeltas.noShow),
      close: normalizeRateValue(rateDeltas.close),
      conversion: normalizeRateValue(rateDeltas.conversion),
    },
  };
}

function DeltaBadge({ delta, inverse = false }) {
  if (!delta || delta.difference === 0) {
    return null;
  }
  const isIncrease = delta.difference > 0;
  const isFavorable = inverse ? !isIncrease : isIncrease;
  const Icon = isIncrease ? TrendingUp : TrendingDown;
  const sign = isIncrease ? "+" : "";

  return (
    <span className={`analytics-delta analytics-delta--${isIncrease ? "up" : "down"} analytics-delta--${isFavorable ? "favorable" : "unfavorable"}`}>
      <Icon aria-hidden="true" />
      <span>
        {sign}{delta.difference}
        {delta.percent !== null && ` (${sign}${delta.percent}%)`}
      </span>
    </span>
  );
}

function RateDeltaBadge({ delta, inverse = false }) {
  if (delta === null) {
    return null;
  }
  if (delta === 0) {
    return (
      <span className="analytics-rate-delta analytics-rate-delta--neutral">
        <span>0 pts</span>
      </span>
    );
  }
  const isIncrease = delta > 0;
  const isFavorable = inverse ? !isIncrease : isIncrease;
  const Icon = isIncrease ? TrendingUp : TrendingDown;
  const sign = isIncrease ? "+" : "";

  return (
    <span className={`analytics-rate-delta analytics-rate-delta--${isIncrease ? "up" : "down"} analytics-rate-delta--${isFavorable ? "favorable" : "unfavorable"}`}>
      <Icon aria-hidden="true" />
      <span>{sign}{delta} pts</span>
    </span>
  );
}

function MetricNode({ className = "", delta, label, status, value }) {
  return (
    <article className={`analytics-flow-node analytics-flow-node--${status} ${className}`}>
      <span className="analytics-flow-node__heading">
        <span className="analytics-flow-node__label">{label}</span>
        <InfoHint label={"Selected-period cohort count.\nCompared with previous period."} />
      </span>
      <strong>{value}</strong>
      <DeltaBadge delta={delta} />
    </article>
  );
}

const overviewTrendFields = {
  scheduled: ["booked", "scheduled"],
  toured: ["toured"],
  enrolled: ["enrolled"],
  churned: ["churned"],
  no_show: ["no_show", "noShow"],
};

function getOverviewTrendValues(trendData, status) {
  const fields = overviewTrendFields[status] || [status];
  return (trendData || []).map((bucket) => {
    const field = fields.find((key) => bucket[key] !== undefined);
    return field ? Number(bucket[field] || 0) : 0;
  });
}

function OverviewSparkline({ status, values }) {
  const usableValues = values?.length ? values : [0, 0];
  const max = Math.max(...usableValues);
  const min = Math.min(...usableValues);
  const range = Math.max(max - min, 1);
  const width = 120;
  const height = 34;
  const points = usableValues.map((value, index) => {
    const x = usableValues.length === 1 ? width : (index / (usableValues.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg
      aria-hidden="true"
      className={`analytics-overview-sparkline analytics-overview-sparkline--${status}`}
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline points={points} />
    </svg>
  );
}

function OverviewMetricCard({ delta, isKeyMetric = false, label, status, trendValues, value }) {
  return (
    <article className={`analytics-overview-card analytics-overview-card--${status}${isKeyMetric ? " analytics-overview-card--key" : ""}`}>
      <span className="analytics-overview-card__label">{label}</span>
      <strong>{value}</strong>
      <DeltaBadge delta={delta} />
      <OverviewSparkline status={status} values={trendValues} />
    </article>
  );
}

function OverviewPerformanceCard({ delta, info, isKeyMetric = false, label, tone, value, valueKind = "rate" }) {
  return (
    <article className={`analytics-overview-performance-card analytics-overview-performance-card--${tone}${isKeyMetric ? " analytics-overview-performance-card--key" : ""}`}>
      <span className="analytics-overview-performance-card__label">{label}</span>
      <strong>
        {valueKind === "days"
          ? value === null
            ? "--"
            : <>{value}<small> day{value === 1 ? "" : "s"}</small></>
          : formatRate(value)}
      </strong>
      {valueKind === "rate" && <RateDeltaBadge delta={delta} />}
      {valueKind === "days" && <span className="analytics-rate-delta analytics-rate-delta--placeholder" aria-hidden="true">No comparison</span>}
      <InfoHint label={info} />
    </article>
  );
}

function OverviewRankingCard({ icon: Icon, items, metric, path, title }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rankedItems = items.slice(0, 3);
  const first = rankedItems[0];

  return (
    <article className={`analytics-preview-card${isExpanded ? " analytics-preview-card--expanded" : ""}`}>
      <h3><button aria-expanded={isExpanded} onClick={() => setIsExpanded((current) => !current)} type="button"><Icon aria-hidden="true" /><span>{title}</span>{isExpanded ? <ChevronUp className="analytics-preview-card__toggle" aria-hidden="true" /> : <ChevronDown className="analytics-preview-card__toggle" aria-hidden="true" />}</button></h3>
      {first ? (
        <>
          <div className="analytics-preview-card__winner">
            <span>1</span>
            <div><small>Top performer</small><strong>{first.name}</strong></div>
            <b>{formatRankingValue(first.value, metric)}</b>
          </div>
          <div className="analytics-preview-card__ranking">
            {rankedItems.slice(1).map((item, index) => (
              <div key={item.name}>
                <span>{index + 2}</span>
                <strong>{item.name}</strong>
                <b>{formatRankingValue(item.value, metric)}</b>
              </div>
            ))}
          </div>
        </>
      ) : <p className="analytics-preview-card__empty">No ranking data for this period.</p>}
      <Link to={path}>Explore more</Link>
    </article>
  );
}

function OverviewFinancialCard({ items }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totals = items.reduce((summary, item) => ({
    revenue: summary.revenue + Number(item.revenue || 0),
    cost: summary.cost + Number(item.cost || 0),
  }), { revenue: 0, cost: 0 });
  const margin = totals.revenue - totals.cost;
  const marginRate = totals.revenue ? Math.round((margin / totals.revenue) * 100) : null;

  return (
    <article className={`analytics-preview-card analytics-preview-card--financial${isExpanded ? " analytics-preview-card--expanded" : ""}`}>
      <h3><button aria-expanded={isExpanded} onClick={() => setIsExpanded((current) => !current)} type="button"><CircleDollarSign aria-hidden="true" /><span>Cost and Margin Analytics</span>{isExpanded ? <ChevronUp className="analytics-preview-card__toggle" aria-hidden="true" /> : <ChevronDown className="analytics-preview-card__toggle" aria-hidden="true" />}</button></h3>
      <div className="analytics-preview-card__winner">
        <div><small>Contribution margin</small><strong>{totals.revenue ? `$${Math.round(margin).toLocaleString()}` : "--"}</strong></div>
        <b>{marginRate === null ? "--" : `${marginRate}%`}</b>
      </div>
      <div className="analytics-preview-card__financial-rows">
        <div><span>Revenue</span><strong>{totals.revenue ? `$${Math.round(totals.revenue).toLocaleString()}` : "--"}</strong></div>
        <div><span>Cost</span><strong>{totals.cost ? `$${Math.round(totals.cost).toLocaleString()}` : "--"}</strong></div>
      </div>
      <Link to="/analytics/cost-margin">Explore more</Link>
    </article>
  );
}

const volumeChartMetrics = [
  { status: "scheduled", field: "booked", label: "Booked" },
  { status: "toured", field: "toured", label: "Toured" },
  { status: "no_show", field: "noShow", label: "No Show" },
  { status: "enrolled", field: "enrolled", label: "Enrolled" },
  { status: "churned", field: "churned", label: "Churned" },
];
const selectableVolumeTrendMetrics = volumeChartMetrics.filter((metric) => metric.status !== "scheduled");
function VolumeTrendChart({ barStatuses = [], curvedStatuses = [], dottedStatuses = [], fixedMax = null, metrics, narrowBarStatuses = [], pointStatuses = [], rows }) {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const chartRef = useRef(null);
  const metricKey = metrics.map((metric) => metric.status).join(",");
  const rangeKey = `${rows[0]?.date || ""}-${rows.at(-1)?.date || ""}-${rows.length}`;
  useEffect(() => {
    const dismissPoint = (event) => {
      if (chartRef.current && !chartRef.current.contains(event.target)) setSelectedPoint(null);
    };
    document.addEventListener("pointerdown", dismissPoint);
    return () => document.removeEventListener("pointerdown", dismissPoint);
  }, []);
  useEffect(() => {
    if (chartRef.current) chartRef.current.scrollLeft = 0;
  }, [metricKey, rangeKey]);
  if (!metrics.length) {
    return <div className="analytics-volume-trend__empty">Select at least one status to view its trend line.</div>;
  }

  const width = 920;
  const height = 320;
  const padding = { top: 22, right: 22, bottom: 48, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = fixedMax ?? Math.max(...metrics.flatMap((metric) => rows.map((row) => Number(row[metric.field] || 0))), 1);
  const groupWidth = plotWidth / Math.max(rows.length, 1);
  const xFor = (index) => padding.left + ((index + 0.5) * groupWidth);
  const yFor = (value) => padding.top + plotHeight - (value / max) * plotHeight;
  const labelStep = Math.max(1, Math.ceil(rows.length / 7));
  const activePoint = selectedPoint && metrics.some((metric) => metric.status === selectedPoint.status) ? selectedPoint : null;
  const barMetrics = metrics.filter((metric) => barStatuses.includes(metric.status));
  const pointMetrics = metrics.filter((metric) => pointStatuses.includes(metric.status));
  const dottedMetrics = metrics.filter((metric) => dottedStatuses.includes(metric.status));
  const lineMetrics = metrics.filter((metric) => !barStatuses.includes(metric.status) && !pointStatuses.includes(metric.status) && !dottedStatuses.includes(metric.status));
  const barWidth = Math.max(4, Math.min(24, (groupWidth * 0.72) / Math.max(barMetrics.length, 1)));
  const getCalculation = (metric, row) => metric.getCalculation?.(row) || null;
  const getSmoothPath = (points) => points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const midpointX = (previous.x + point.x) / 2;
    return `${path} C ${midpointX} ${previous.y}, ${midpointX} ${point.y}, ${point.x} ${point.y}`;
  }, "");

  return (
    <div className="analytics-volume-trend-chart" ref={chartRef}>
      <svg aria-label="Selected event volume trends over time" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = Math.round(max - (max / 4) * tick);
          const y = padding.top + (plotHeight / 4) * tick;
          return <g key={tick}><line className="analytics-volume-trend-chart__grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} /><text className="analytics-volume-trend-chart__axis-label" textAnchor="end" x={padding.left - 10} y={y + 4}>{value}</text></g>;
        })}
        {rows.map((row, index) => (index % labelStep === 0 || index === rows.length - 1) && <text className="analytics-volume-trend-chart__axis-label" key={row.date} textAnchor="middle" x={xFor(index)} y={height - 18}>{row.label || row.date}</text>)}
        {barMetrics.flatMap((metric, metricIndex) => rows.map((row, index) => {
          const value = Number(row[metric.field] || 0);
          const groupOffset = (metricIndex - ((barMetrics.length - 1) / 2)) * barWidth;
          const barCenter = xFor(index) + groupOffset;
          const metricBarWidth = narrowBarStatuses.includes(metric.status) ? Math.max(3, barWidth * 0.5) : barWidth;
          const x = barCenter - metricBarWidth / 2;
          const y = yFor(value);
          const point = { calculation: getCalculation(metric, row), dateLabel: row.label || row.date, status: metric.status, statusLabel: metric.label, value, x: barCenter, y };
          return <rect aria-label={`${metric.label}, ${point.dateLabel}: ${value}`} className={`analytics-volume-trend-chart__bar analytics-volume-trend-chart__bar--${metric.status}`} height={padding.top + plotHeight - y} key={`${metric.status}-${row.date}`} onClick={() => setSelectedPoint(point)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedPoint(point); }} role="button" rx="3" tabIndex="0" width={metricBarWidth} x={x} y={y}><title>{metric.label} · {point.dateLabel}: {value}</title></rect>;
        }))}
        {lineMetrics.map((metric) => {
          const pointCoordinates = rows.map((row, index) => ({ x: xFor(index), y: yFor(Number(row[metric.field] || 0)) }));
          const points = pointCoordinates.map((point) => `${point.x},${point.y}`).join(" ");
          return (
            <g className={`analytics-volume-trend-chart__series analytics-volume-trend-chart__series--${metric.status}`} key={metric.status}>
              {curvedStatuses.includes(metric.status) ? <path d={getSmoothPath(pointCoordinates)} /> : <polyline points={points} />}
              {rows.map((row, index) => {
                const value = Number(row[metric.field] || 0);
                const point = { calculation: getCalculation(metric, row), dateLabel: row.label || row.date, status: metric.status, statusLabel: metric.label, value, x: xFor(index), y: yFor(value) };
                return <circle aria-label={`${metric.label}, ${point.dateLabel}: ${value}`} cx={point.x} cy={point.y} key={row.date} onClick={() => setSelectedPoint(point)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedPoint(point); }} r="4" role="button" tabIndex="0"><title>{metric.label} · {point.dateLabel}: {value}</title></circle>;
              })}
            </g>
          );
        })}
        {pointMetrics.map((metric) => <polyline className={`analytics-volume-trend-chart__dotted-line analytics-volume-trend-chart__dotted-line--${metric.status}`} key={`${metric.status}-point-line`} points={rows.map((row, index) => `${xFor(index)},${yFor(Number(row[metric.field] || 0))}`).join(" ")} />)}
        {pointMetrics.flatMap((metric) => rows.map((row, index) => {
          const value = Number(row[metric.field] || 0);
          const point = { calculation: getCalculation(metric, row), dateLabel: row.label || row.date, status: metric.status, statusLabel: metric.label, value, x: xFor(index), y: yFor(value) };
          return <g aria-label={`${metric.label}, ${point.dateLabel}: ${value}`} className={`analytics-volume-trend-chart__x-point analytics-volume-trend-chart__x-point--${metric.status}`} key={`${metric.status}-${row.date}`} onClick={() => setSelectedPoint(point)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedPoint(point); }} role="button" tabIndex="0"><line x1={point.x - 5} x2={point.x + 5} y1={point.y - 5} y2={point.y + 5} /><line x1={point.x - 5} x2={point.x + 5} y1={point.y + 5} y2={point.y - 5} /><title>{metric.label} · {point.dateLabel}: {value}</title></g>;
        }))}
        {dottedMetrics.map((metric) => <g key={`${metric.status}-dotted`}><polyline className={`analytics-volume-trend-chart__dotted-line analytics-volume-trend-chart__dotted-line--${metric.status}`} points={rows.map((row, index) => `${xFor(index)},${yFor(Number(row[metric.field] || 0))}`).join(" ")} />{rows.map((row, index) => { const value = Number(row[metric.field] || 0); const point = { calculation: getCalculation(metric, row), dateLabel: row.label || row.date, status: metric.status, statusLabel: metric.label, value, x: xFor(index), y: yFor(value) }; return <circle aria-label={`${metric.label}, ${point.dateLabel}: ${value}`} className="analytics-volume-trend-chart__dotted-point" cx={point.x} cy={point.y} key={row.date} onClick={() => setSelectedPoint(point)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedPoint(point); }} r="4" role="button" tabIndex="0"><title>{metric.label} · {point.dateLabel}: {value}</title></circle>; })}</g>)}
        {activePoint && (
          <g className="analytics-volume-trend-chart__point-label" transform={`translate(${Math.min(width - 152, Math.max(8, activePoint.x - 70))} ${Math.max(4, activePoint.y - (activePoint.calculation ? 50 : 38))})`}>
            <rect height={activePoint.calculation ? 42 : 30} rx="7" width="144" />
            <text textAnchor="middle" x="72" y="13">{activePoint.statusLabel}: {activePoint.value}{fixedMax === 100 ? "%" : ""}</text>
            {activePoint.calculation && <text textAnchor="middle" x="72" y="25">{activePoint.calculation}</text>}
            <text textAnchor="middle" x="72" y={activePoint.calculation ? 36 : 24}>{activePoint.dateLabel}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

function VolumeStackedOption({ metrics }) {
  const total = metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  return (
    <section className="analytics-volume-panel" aria-labelledby="volume-stacked-option-title">
      <div className="analytics-volume-panel__heading"><div><h2 id="volume-stacked-option-title">Volume and Event Share</h2></div></div>
      <div className="analytics-volume-stacked">
        <div className="analytics-volume-stacked__bar">
          {metrics.map((metric) => {
            const percentage = total ? (metric.value / total) * 100 : 0;
            return <span className={`is-${metric.status}`} key={metric.status} style={{ width: `${percentage}%` }} title={`${metric.label}: ${metric.value} (${percentage.toFixed(1)}%)`}>{percentage >= 9 ? `${percentage.toFixed(1)}%` : ""}</span>;
          })}
        </div>
        <div className="analytics-volume-stacked__key">
          {metrics.map((metric) => <div key={metric.status}><i className={`is-${metric.status}`} /><span>{metric.label}</span></div>)}
        </div>
        <div className="analytics-volume-stacked__legend">
          <div className="analytics-volume-stacked__row-labels"><span>Current</span><span>Previous</span><span>Diff</span></div>
          {metrics.map((metric) => {
            const inverse = ["no_show", "churned"].includes(metric.status);
            return (
              <div className="analytics-volume-stacked__values" key={metric.status}>
                <div className="analytics-volume-stacked__data-row">
                  <strong>{metric.value}</strong>
                </div>
                <div className="analytics-volume-stacked__data-row">
                  <strong>{metric.previousValue}</strong>
                </div>
                <div className="analytics-volume-stacked__data-row analytics-volume-stacked__data-row--diff">
                  <DeltaBadge delta={metric.delta} inverse={inverse} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function groupVolumeByWeek(rows) {
  const weeks = new Map();
  rows.forEach((row) => {
    const date = new Date(`${row.date}T12:00:00`);
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const current = weeks.get(key) || {
      date: key,
      label: `Week of ${monday.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      booked: 0,
      toured: 0,
      enrolled: 0,
      noShow: 0,
      churned: 0,
    };
    ["booked", "toured", "enrolled", "noShow", "churned"].forEach((field) => { current[field] += Number(row[field] || 0); });
    weeks.set(key, current);
  });
  return Array.from(weeks.values()).sort((first, second) => first.date.localeCompare(second.date));
}

function groupVolumeByMonth(rows) {
  const months = new Map();
  rows.forEach((row) => {
    const date = new Date(`${row.date}T12:00:00`);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    const current = months.get(key) || {
      date: key,
      label: date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      booked: 0,
      toured: 0,
      enrolled: 0,
      noShow: 0,
      churned: 0,
    };
    ["booked", "toured", "enrolled", "noShow", "churned"].forEach((field) => { current[field] += Number(row[field] || 0); });
    months.set(key, current);
  });
  return Array.from(months.values()).sort((first, second) => first.date.localeCompare(second.date));
}

function ordinalDay(day) {
  const suffix = day % 10 === 1 && day % 100 !== 11 ? "st" : day % 10 === 2 && day % 100 !== 12 ? "nd" : day % 10 === 3 && day % 100 !== 13 ? "rd" : "th";
  return `${day}${suffix}`;
}

function buildTemporalRankingGroups(rows, metric) {
  const dimensions = [
    { key: "quarter", title: "Quarter", describe: (date) => { const quarter = Math.floor(date.getMonth() / 3) + 1; return { key: String(quarter), label: `Q${quarter}` }; } },
    { key: "month", title: "Month", describe: (date) => ({ key: String(date.getMonth()), label: date.toLocaleDateString(undefined, { month: "long" }) }) },
    { key: "week", title: "Week of Month", describe: (date) => { const week = Math.ceil(date.getDate() / 7); return { key: String(week), label: `Week ${week}` }; } },
    { key: "dayOfMonth", title: "Day of Month", describe: (date) => ({ key: String(date.getDate()), label: ordinalDay(date.getDate()) }) },
    { key: "dayOfWeek", title: "Day of Week", describe: (date) => ({ key: String(date.getDay()), label: date.toLocaleDateString(undefined, { weekday: "long" }) }) },
  ];

  return dimensions.map((dimension) => {
    const buckets = new Map();
    rows.forEach((row) => {
      const date = new Date(`${row.date}T12:00:00`);
      const descriptor = dimension.describe(date);
      const bucket = buckets.get(descriptor.key) || { key: descriptor.key, label: descriptor.label, value: 0 };
      bucket.value += Number(row[metric.field] || 0);
      buckets.set(descriptor.key, bucket);
    });
    return { ...dimension, entries: Array.from(buckets.values()) };
  });
}

function TemporalDistributionPlot({ dimension, entries, status }) {
  const orderedEntries = [...entries].sort((first, second) => Number(first.key) - Number(second.key));
  const maxValue = Math.max(...orderedEntries.map((entry) => entry.value), 1);
  if (dimension === "dayOfMonth") {
    const points = orderedEntries.map((entry) => {
      const x = 5 + ((Number(entry.key) - 1) / 30) * 300;
      const y = 43 - (entry.value / maxValue) * 36;
      return { ...entry, height: 43 - y, x, y };
    });
    const ticks = [1, 5, 10, 15, 20, 25, 31];
    return <div className={`analytics-temporal-line-plot analytics-temporal-line-plot--${status}`} aria-label="Volume distribution by day of month"><svg role="img" viewBox="0 0 310 58"><line className="analytics-temporal-line-plot__axis" x1="5" x2="305" y1="43" y2="43" />{points.map((point) => <rect className="analytics-temporal-line-plot__bar" height={Math.max(point.height, point.value ? 2 : 1)} key={point.key} rx="1.2" width="6" x={point.x - 3} y={point.value ? point.y : 42}><title>{point.label}: {point.value}</title></rect>)}{ticks.map((tick) => <text key={tick} textAnchor="middle" x={5 + ((tick - 1) / 30) * 300} y="55">{tick}</text>)}</svg></div>;
  }
  return <div className={`analytics-temporal-plot analytics-temporal-plot--${status}`} aria-label="Volume distribution">{orderedEntries.map((entry) => <div className="analytics-temporal-plot__item" key={entry.key} title={`${entry.label}: ${entry.value}`}><span className="analytics-temporal-plot__track"><i style={{ height: `${Math.max((entry.value / maxValue) * 100, entry.value ? 8 : 2)}%` }} /></span><span className="analytics-temporal-plot__label">{entry.label}</span></div>)}</div>;
}

function VolumeTemporalRankings({ allTimeRows, rows }) {
  const [metricStatus, setMetricStatus] = useState("scheduled");
  const [rankingDirection, setRankingDirection] = useState("highest");
  const [rankingScope, setRankingScope] = useState("selected");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const metric = volumeChartMetrics.find((item) => item.status === metricStatus) || volumeChartMetrics[0];
  const groups = buildTemporalRankingGroups(rankingScope === "all" ? allTimeRows : rows, metric);

  useEffect(() => {
    const dismissDropdown = (event) => {
      document.querySelectorAll(".analytics-temporal-rankings__picker[open]").forEach((picker) => {
        if (!picker.contains(event.target)) picker.removeAttribute("open");
      });
    };
    document.addEventListener("pointerdown", dismissDropdown);
    return () => document.removeEventListener("pointerdown", dismissDropdown);
  }, []);

  return (
    <section className="analytics-temporal-rankings" aria-labelledby="temporal-rankings-title">
      <div className="analytics-temporal-rankings__banner">
        <div className="analytics-temporal-rankings__title"><h2 id="temporal-rankings-title"><ArrowDownUp aria-hidden="true" /><span>Temporal Volume Rankings</span><span className="analytics-temporal-rankings__mobile-info"><InfoHint label={`${metric.label}\nRanked by event count\n${rankingScope === "all" ? "All time" : "Selected period"}`} /></span></h2><span>{metric.label} · Ranked by event count · {rankingScope === "all" ? "All time" : "Selected period"}</span></div>
        <div className="analytics-temporal-rankings__field"><details className="analytics-temporal-rankings__picker"><summary><span><small>Status:</small><b>{metric.label}</b></span></summary><div>{volumeChartMetrics.map((item) => <button className={metricStatus === item.status ? "is-selected" : ""} key={item.status} onClick={(event) => { setMetricStatus(item.status); event.currentTarget.closest("details")?.removeAttribute("open"); }} type="button"><span>{item.label}</span>{metricStatus === item.status && <Check aria-hidden="true" />}</button>)}</div></details></div>
        <div className="analytics-temporal-rankings__scope"><span><CalendarDays aria-hidden="true" /><b>Selected period</b></span><button aria-checked={rankingScope === "all"} aria-label="Toggle between selected period and all time" onClick={() => setRankingScope((scope) => scope === "selected" ? "all" : "selected")} role="switch" type="button"><i /></button><span><InfinityIcon aria-hidden="true" /><b>All time</b></span></div>
        <div className="analytics-temporal-rankings__toggle"><button aria-label="Highest volume" className={rankingDirection === "highest" ? "is-active" : ""} onClick={() => setRankingDirection("highest")} type="button"><TrendingUp aria-hidden="true" /><span>Highest volume</span></button><button aria-label="Lowest volume" className={rankingDirection === "lowest" ? "is-active" : ""} onClick={() => setRankingDirection("lowest")} type="button"><TrendingDown aria-hidden="true" /><span>Lowest volume</span></button></div>
      </div>
      <div className="analytics-temporal-rankings__grid">{groups.map((group) => {
        const entries = [...group.entries].sort((first, second) => (rankingDirection === "lowest" ? first.value - second.value : second.value - first.value) || first.label.localeCompare(second.label));
        const topEntry = entries[0];
        const isExpanded = expandedGroup === group.key;
        return <article className={isExpanded ? "is-expanded" : ""} key={group.key}><button aria-expanded={isExpanded} className="analytics-temporal-rankings__card-heading" onClick={() => setExpandedGroup((current) => current === group.key ? null : group.key)} type="button"><h3>{group.title}</h3>{topEntry && <strong><span>{topEntry.label}</span><em>{topEntry.value}</em></strong>}<ChevronDown aria-hidden="true" /></button><span>{rankingDirection === "highest" ? "Highest volume" : "Lowest volume"}</span><TemporalDistributionPlot dimension={group.key} entries={group.entries} status={metric.status} /><ol>{entries.map((entry, index) => <li className={index === 0 ? "is-top" : ""} key={entry.key}><b>{index + 1}</b><strong>{entry.label}</strong><em>{entry.value}</em></li>)}</ol></article>;
      })}</div>
    </section>
  );
}

function VolumePerformanceRankings({ allTimeRankings, rankings }) {
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("highest");
  const [scope, setScope] = useState("selected");
  const selectedStatus = volumePerformanceStatusOptions.find((option) => option.value === status) || volumePerformanceStatusOptions[0];
  const activeRankings = scope === "all" ? allTimeRankings : rankings;
  const prepareItems = (items) => [...(items || [])]
    .map((item) => ({
      ...item,
      detail: status === "all" ? "Total status events" : `${Number(item[status] || 0).toLocaleString()} ${selectedStatus.label.toLowerCase()} event${Number(item[status] || 0) === 1 ? "" : "s"}`,
      metric: "enrollment",
      value: Number(item[status] || 0),
    }))
    .sort((first, second) => direction === "highest" ? second.value - first.value : first.value - second.value);
  return (
    <section className="analytics-volume-performance-rankings" aria-labelledby="volume-performance-rankings-title">
      <div className="analytics-temporal-rankings__banner" aria-label="Volume performance ranking controls">
        <div className="analytics-temporal-rankings__title"><h2 id="volume-performance-rankings-title"><ArrowDownUp aria-hidden="true" /><span>Volume Performance Rankings</span><span className="analytics-temporal-rankings__mobile-info"><InfoHint label={`${selectedStatus.label}\nRanked by event count\n${scope === "all" ? "All time" : "Selected period"}`} /></span></h2><span>{selectedStatus.label} · Ranked by event count · {scope === "all" ? "All time" : "Selected period"}</span></div>
        <div className="analytics-temporal-rankings__field"><details className="analytics-temporal-rankings__picker"><summary><span><small>Status:</small><b>{selectedStatus.label}</b></span></summary><div>{volumePerformanceStatusOptions.map((option) => <button className={status === option.value ? "is-selected" : ""} key={option.value} onClick={(event) => { setStatus(option.value); event.currentTarget.closest("details")?.removeAttribute("open"); }} type="button"><span>{option.label}</span>{status === option.value && <Check aria-hidden="true" />}</button>)}</div></details></div>
        <div className="analytics-temporal-rankings__scope"><span><CalendarDays aria-hidden="true" /><b>Selected period</b></span><button aria-checked={scope === "all"} aria-label="Toggle between selected period and all time" onClick={() => setScope((current) => current === "selected" ? "all" : "selected")} role="switch" type="button"><i /></button><span><InfinityIcon aria-hidden="true" /><b>All time</b></span></div>
        <div className="analytics-temporal-rankings__toggle">
          <button aria-label="Highest volume" className={direction === "highest" ? "is-active" : ""} onClick={() => setDirection("highest")} type="button"><TrendingUp aria-hidden="true" /><span>Highest volume</span></button>
          <button aria-label="Lowest volume" className={direction === "lowest" ? "is-active" : ""} onClick={() => setDirection("lowest")} type="button"><TrendingDown aria-hidden="true" /><span>Lowest volume</span></button>
        </div>
      </div>
      <div className="analytics-ranking-grid">
        <RankingList items={prepareItems(activeRankings?.locations)} metric="enrollment" metricLabel={selectedStatus.label} sortLabel={`${direction === "highest" ? "Highest" : "Lowest"} volume · ${scope === "all" ? "All time" : "Selected period"}`} title="Location" />
        <RankingList items={prepareItems(activeRankings?.leadSources)} metric="enrollment" metricLabel={selectedStatus.label} sortLabel={`${direction === "highest" ? "Highest" : "Lowest"} volume · ${scope === "all" ? "All time" : "Selected period"}`} title="Lead Source" />
        <RankingList items={prepareItems(activeRankings?.staff)} metric="enrollment" metricLabel={selectedStatus.label} sortLabel={`${direction === "highest" ? "Highest" : "Lowest"} volume · ${scope === "all" ? "All time" : "Selected period"}`} title="Staff" />
      </div>
    </section>
  );
}

function VolumeAnalyticsWorkspace({ analytics, periodComparison }) {
  const [eventTrendMode, setEventTrendMode] = useState("daily");
  const [trendWindowOffset, setTrendWindowOffset] = useState(0);
  const [selectedTrendStatuses, setSelectedTrendStatuses] = useState(() => selectableVolumeTrendMetrics.map((metric) => metric.status));
  const dailyTrendRows = analytics.volumeCalendarData.map((row) => ({
    ...row,
    label: new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  const eventTrendRows = eventTrendMode === "weekly"
    ? groupVolumeByWeek(dailyTrendRows)
    : eventTrendMode === "monthly"
      ? groupVolumeByMonth(dailyTrendRows)
      : dailyTrendRows;
  const trendWindowSize = eventTrendMode === "daily" ? 14 : 12;
  const trendWindowEnd = Math.max(0, eventTrendRows.length - trendWindowOffset);
  const trendWindowStart = Math.max(0, trendWindowEnd - trendWindowSize);
  const visibleTrendRows = eventTrendRows.slice(trendWindowStart, trendWindowEnd);
  const canShowOlderTrends = trendWindowStart > 0;
  const canShowNewerTrends = trendWindowOffset > 0;
  const trendWindowLabel = visibleTrendRows.length ? `${visibleTrendRows[0].label || visibleTrendRows[0].date} – ${visibleTrendRows.at(-1).label || visibleTrendRows.at(-1).date}` : "No dates available";
  const selectedTrendMetrics = selectableVolumeTrendMetrics.filter((metric) => selectedTrendStatuses.includes(metric.status));
  const selectedTourTrendMetrics = selectedTrendMetrics.filter((metric) => ["toured", "no_show"].includes(metric.status));
  const selectedOutcomeTrendMetrics = selectedTrendMetrics.filter((metric) => ["enrolled", "churned"].includes(metric.status));
  const toggleTrendStatus = (status) => setSelectedTrendStatuses((selected) => (
    selected.includes(status) ? selected.filter((item) => item !== status) : [...selected, status]
  ));

  useEffect(() => {
    const dismissDropdowns = (event) => {
      document.querySelectorAll(".analytics-volume-trend__picker[open]").forEach((picker) => {
        if (!picker.contains(event.target)) picker.removeAttribute("open");
      });
    };
    document.addEventListener("pointerdown", dismissDropdowns);
    return () => document.removeEventListener("pointerdown", dismissDropdowns);
  }, []);

  return (
    <section className="analytics-workspace analytics-volume-workspace" aria-label="Volume and trend analytics">
      <div className="analytics-period"><strong>{periodComparison.selected}</strong>{periodComparison.previous && <span>vs {periodComparison.previous}</span>}</div>

      <VolumeStackedOption metrics={analytics.volumeMetrics} />

      <section className="analytics-volume-panel" aria-labelledby="volume-events-title">
        <div className="analytics-volume-trend__control-region">
        <div className="analytics-volume-panel__heading"><div><h2 id="volume-events-title">Volume Trends</h2></div><div className="analytics-volume-trend__controls"><div className="analytics-volume-trend__field"><span>Timeline</span><details className="analytics-volume-trend__picker analytics-volume-trend__picker--timeline"><summary>{eventTrendMode[0].toUpperCase() + eventTrendMode.slice(1)}</summary><div>{["daily", "weekly", "monthly"].map((mode) => <button className={eventTrendMode === mode ? "is-selected" : ""} key={mode} onClick={(event) => { setEventTrendMode(mode); setTrendWindowOffset(0); event.currentTarget.closest("details")?.removeAttribute("open"); }} type="button"><span>{mode[0].toUpperCase() + mode.slice(1)}</span>{eventTrendMode === mode && <Check aria-hidden="true" />}</button>)}</div></details></div><div className="analytics-volume-trend__field"><span>Statuses</span><details className="analytics-volume-trend__picker"><summary>{selectedTrendStatuses.length ? `${selectedTrendStatuses.length} selected` : "Select statuses"}</summary><div><div className="analytics-volume-trend__actions"><button onClick={() => setSelectedTrendStatuses(selectableVolumeTrendMetrics.map((metric) => metric.status))} type="button">Select all</button><button onClick={() => setSelectedTrendStatuses([])} type="button">Clear</button></div>{selectableVolumeTrendMetrics.map((metric) => <label key={metric.status}><input checked={selectedTrendStatuses.includes(metric.status)} onChange={() => toggleTrendStatus(metric.status)} type="checkbox" /><i className={`is-${metric.status}`} />{metric.label}</label>)}</div></details></div></div></div>
        <div className="analytics-volume-trend__navigator"><button aria-label="Show older dates" disabled={!canShowOlderTrends} onClick={() => setTrendWindowOffset((offset) => Math.min(eventTrendRows.length, offset + trendWindowSize))} type="button"><ChevronLeft aria-hidden="true" />Older</button><strong>{trendWindowLabel}</strong><button aria-label="Show newer dates" disabled={!canShowNewerTrends} onClick={() => setTrendWindowOffset((offset) => Math.max(0, offset - trendWindowSize))} type="button">Newer<ChevronRight aria-hidden="true" /></button></div>
        </div>
        <section className="analytics-volume-trend__booked"><h3>Booked</h3><div className="analytics-volume-trend__legend"><span><i />Booked</span></div><VolumeTrendChart metrics={volumeChartMetrics.filter((metric) => metric.status === "scheduled")} rows={visibleTrendRows} /></section>
        <div className="analytics-volume-trend__split">
          <section><h3>Tours</h3>{selectedTourTrendMetrics.length ? <><div className="analytics-volume-trend__legend">{selectedTourTrendMetrics.map((metric) => <span key={metric.status}><i className={`is-${metric.status}`} />{metric.label}</span>)}</div><VolumeTrendChart barStatuses={["no_show"]} metrics={selectedTourTrendMetrics} rows={visibleTrendRows} /></> : <div className="analytics-volume-trend__empty">Select Toured or No Show to view this trend.</div>}</section>
          <section><h3>Outcomes</h3>{selectedOutcomeTrendMetrics.length ? <><div className="analytics-volume-trend__legend">{selectedOutcomeTrendMetrics.map((metric) => <span key={metric.status}><i className={`is-${metric.status}`} />{metric.label}</span>)}</div><VolumeTrendChart barStatuses={["churned"]} metrics={selectedOutcomeTrendMetrics} rows={visibleTrendRows} /></> : <div className="analytics-volume-trend__empty">Select Enrolled or Churned to view this trend.</div>}</section>
        </div>
      </section>

      <VolumeTemporalRankings allTimeRows={analytics.allTimeVolumeCalendarData} rows={analytics.volumeCalendarData} />

      <VolumePerformanceRankings allTimeRankings={analytics.allTimeVolumePerformanceRankings} rankings={analytics.volumePerformanceRankings} />

    </section>
  );
}

const locationVolumeOptions = [
  { value: "all", label: "All Events", color: "#673de6" },
  { value: "booked", label: "Booked", color: "#2f6df6" },
  { value: "toured", label: "Toured", color: "#d4a017" },
  { value: "noShow", label: "No Show", color: "#ff8a1f" },
  { value: "enrolled", label: "Enrolled", color: "#18a05e" },
  { value: "churned", label: "Churned", color: "#e3344f" },
];
const locationPerformanceOptions = [
  { value: "enrollments", label: "Enrollments", color: "#2563eb" },
  { value: "toured", label: "Toured Rate", color: "#d4a017" },
  { value: "conversion", label: "Conversion Rate", color: "#18a05e" },
  { value: "averageDays", label: "Avg. Days to Enroll", color: "#673de6" },
  { value: "close", label: "Close Rate", color: "#0f9f9a" },
  { value: "noShow", label: "No Show Rate", color: "#ff8a1f" },
];

function getHeatColor(hexColor, value, maximum) {
  const intensity = maximum ? Math.max(0, Math.min(1, value / maximum)) : 0;
  const colorWeight = 0.25 + intensity * 0.75;
  const channels = [1, 3, 5].map((index) => Number.parseInt(hexColor.slice(index, index + 2), 16));
  return `rgb(${channels.map((channel) => Math.round(255 - (255 - channel) * colorWeight)).join(", ")})`;
}

function getLocationPerformance(item, metric) {
  if (metric === "enrollments") return { value: item.enrolled, detail: `${item.enrolled} enrolled families` };
  if (metric === "toured") return { value: getPercent(item.toured, item.booked), detail: `${item.toured} toured / ${item.booked} booked` };
  if (metric === "noShow") return { value: getPercent(item.noShow, item.booked), detail: `${item.noShow} no show / ${item.booked} booked` };
  if (metric === "close") return { value: getPercent(item.enrolled + item.churned, item.toured), detail: `${item.enrolled + item.churned} closed / ${item.toured} toured` };
  if (metric === "averageDays") return { value: item.averageDaysToEnroll ?? null, detail: `${item.enrolled} enrolled` };
  return { value: getPercent(item.enrolled, item.toured), detail: `${item.enrolled} enrolled / ${item.toured} toured` };
}

function LocationChartPicker({ label, onChange, options, value }) {
  const pickerRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const closeOutside = (event) => {
      if (!pickerRef.current?.contains(event.target)) {
        pickerRef.current?.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <label className="analytics-location-picker">
      <span>{label}</span>
      <details ref={pickerRef}>
        <summary><i style={{ background: selectedOption.color }} /><b>{selectedOption.label}</b><ChevronDown aria-hidden="true" /></summary>
        <div>{options.map((option) => <button className={option.value === value ? "is-selected" : ""} key={option.value} onClick={(event) => { onChange(option.value); event.currentTarget.closest("details")?.removeAttribute("open"); }} type="button"><i style={{ background: option.color }} /><span>{option.label}</span>{option.value === value && <Check aria-hidden="true" />}</button>)}</div>
      </details>
    </label>
  );
}

const entityTrendPerformanceOptions = locationPerformanceOptions.filter((option) => option.value !== "enrollments");
const entityTrendTimelineOptions = trendModeOptions.map((option) => ({ ...option, color: "#673de6" }));

function groupPerformanceTrendRows(rows, timeline) {
  if (timeline === "daily") return rows;
  const buckets = new Map();
  rows.forEach((row) => {
    const date = new Date(`${row.date}T12:00:00`);
    const bucketDate = new Date(date);
    if (timeline === "weekly") bucketDate.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    else bucketDate.setDate(1);
    const key = toDateInputValue(bucketDate);
    const current = buckets.get(key) || { date: key, booked: 0, toured: 0, noShow: 0, enrolled: 0, churned: 0, averageDaysCount: 0, averageDaysTotal: 0 };
    ["booked", "toured", "noShow", "enrolled", "churned"].forEach((field) => { current[field] += Number(row[field] || 0); });
    current.averageDaysCount += Number(row.averageDaysCount || 0);
    current.averageDaysTotal += Number(row.averageDaysToEnroll || 0) * Number(row.averageDaysCount || 0);
    buckets.set(key, current);
  });
  return Array.from(buckets.values()).map((row) => ({
    ...row,
    label: timeline === "weekly" ? `Week of ${new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    touredRate: getPercent(row.toured, row.booked),
    noShowRate: getPercent(row.noShow, row.booked),
    closeRate: getPercent(row.enrolled + row.churned, row.toured),
    conversionRate: getPercent(row.enrolled, row.toured),
    averageDaysToEnroll: row.averageDaysCount ? Math.round((row.averageDaysTotal / row.averageDaysCount) * 10) / 10 : null,
  })).sort((first, second) => first.date.localeCompare(second.date));
}

function EntityLineChart({ isDurationMixed = false, rows, series, standardMaxOverride = null }) {
  const width = 720;
  const height = 230;
  const padding = { left: 42, right: isDurationMixed ? 44 : 18, top: 18, bottom: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const durationMax = Math.max(...series.filter((item) => item.isDuration).flatMap((item) => item.values.map((value) => Number(value || 0))), 1);
  const standardMax = standardMaxOverride || Math.max(...series.filter((item) => !item.isDuration).flatMap((item) => item.values.map((value) => Number(value || 0))), 1);
  const xFor = (index) => padding.left + (rows.length <= 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const yFor = (value, isDuration) => padding.top + plotHeight - (Number(value || 0) / (isDuration ? durationMax : standardMax)) * plotHeight;
  return (
    <div className="analytics-entity-trend-chart">
      <svg aria-label="Trend chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight * ratio} y2={padding.top + plotHeight * ratio} /><text x={padding.left - 7} y={padding.top + plotHeight * ratio + 3}>{Math.round(standardMax * (1 - ratio))}</text>{isDurationMixed && <text className="is-right" x={width - padding.right + 7} y={padding.top + plotHeight * ratio + 3}>{Math.round(durationMax * (1 - ratio))}d</text>}</g>)}
        {series.map((item) => {
          const points = item.values.map((value, index) => `${xFor(index)},${yFor(value, item.isDuration)}`).join(" ");
          return <g key={item.name}><polyline className="analytics-entity-trend-chart__line" points={points} style={{ stroke: item.color }} />{item.values.map((value, index) => <circle cx={xFor(index)} cy={yFor(value, item.isDuration)} fill={item.color} key={`${item.name}-${rows[index]?.date}`} r="3"><title>{item.name} · {rows[index]?.label || rows[index]?.date}: {value ?? "--"}{item.isDuration ? " days" : ""}</title></circle>)}</g>;
        })}
        {rows.map((row, index) => (index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 5)) === 0) && <text className="analytics-entity-trend-chart__x-label" key={row.date} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"} x={xFor(index)} y={height - 10}>{row.label || row.date}</text>)}
      </svg>
    </div>
  );
}

// Kept as an isolated chart primitive for future analytics reuse; it is not rendered on entity pages.
// eslint-disable-next-line no-unused-vars
function EntityTrendPanel({ data, entityLabel, isSingleEntity, kind }) {
  const isVolume = kind === "volume";
  const options = isVolume ? locationVolumeOptions.filter((option) => option.value !== "all") : entityTrendPerformanceOptions;
  const [metric, setMetric] = useState(isVolume ? "booked" : "conversion");
  const [timeline, setTimeline] = useState("daily");
  const [windowOffset, setWindowOffset] = useState(0);
  const metricOption = options.find((option) => option.value === metric) || options[0];
  const fieldByMetric = { booked: "booked", toured: "toured", noShow: "noShow", enrolled: "enrolled", churned: "churned", conversion: "conversionRate", close: "closeRate", averageDays: "averageDaysToEnroll" };
  const preparedEntities = data.map((entity) => ({
    ...entity,
    rows: isVolume
      ? timeline === "weekly" ? groupVolumeByWeek(entity.volume || []) : timeline === "monthly" ? groupVolumeByMonth(entity.volume || []) : entity.volume || []
      : groupPerformanceTrendRows(entity.performance || [], timeline),
  }));
  const baseRows = preparedEntities[0]?.rows || [];
  const windowSize = timeline === "daily" ? 14 : 12;
  const windowEnd = Math.max(0, baseRows.length - windowOffset);
  const windowStart = Math.max(0, windowEnd - windowSize);
  const visibleRows = baseRows.slice(windowStart, windowEnd);
  const activeOptions = isSingleEntity ? options : [metricOption];
  const series = isSingleEntity
    ? activeOptions.map((option) => ({
      color: option.color,
      isDuration: option.value === "averageDays",
      name: option.label,
      values: (preparedEntities[0]?.rows || []).slice(windowStart, windowEnd).map((row) => row[fieldByMetric[option.value]]),
    }))
    : preparedEntities.map((entity, index) => ({
      color: getHeatColor(metricOption.color, preparedEntities.length - index, preparedEntities.length),
      isDuration: metric === "averageDays",
      name: entity.name,
      values: entity.rows.slice(windowStart, windowEnd).map((row) => row[fieldByMetric[metric]]),
    }));
  const rangeLabel = visibleRows.length ? `${visibleRows[0].label || visibleRows[0].date} – ${visibleRows.at(-1).label || visibleRows.at(-1).date}` : "No dates available";
  return (
    <section className="analytics-entity-trend-panel">
      <header><div><h2>{isVolume ? "Volume Trends" : "Rate and Enrollment-Time Trends"}</h2><p>{isVolume ? "Event dates" : "Scheduled-tour cohorts"} · {isSingleEntity ? `All ${isVolume ? "statuses" : "metrics"}` : `One line per ${entityLabel.toLowerCase()}`}</p></div><div>{!isSingleEntity && <LocationChartPicker label={isVolume ? "Status" : "Metric"} onChange={(value) => { setMetric(value); setWindowOffset(0); }} options={options} value={metric} />}<LocationChartPicker label="Timeline" onChange={(value) => { setTimeline(value); setWindowOffset(0); }} options={entityTrendTimelineOptions} value={timeline} /></div></header>
      <div className="analytics-entity-trend-panel__navigator"><button disabled={windowStart <= 0} onClick={() => setWindowOffset((offset) => Math.min(baseRows.length, offset + windowSize))} type="button"><ChevronLeft aria-hidden="true" />Older</button><strong>{rangeLabel}</strong><button disabled={windowOffset <= 0} onClick={() => setWindowOffset((offset) => Math.max(0, offset - windowSize))} type="button">Newer<ChevronRight aria-hidden="true" /></button></div>
      <div className="analytics-entity-trend-panel__legend">{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>
      {visibleRows.length ? <EntityLineChart isDurationMixed={!isVolume && isSingleEntity} rows={visibleRows} series={series} standardMaxOverride={isVolume ? null : 100} /> : <p className="analytics-entity-trend-panel__empty">No trend data for this period.</p>}
    </section>
  );
}

function EntityAnalyticsWorkspace({ analytics, dimension, filters, leadSources, locations, user }) {
  const [volumeStatus, setVolumeStatus] = useState("all");
  const [performanceMetric, setPerformanceMetric] = useState("conversion");
  const [selectedVolumeEntity, setSelectedVolumeEntity] = useState(null);
  const volumeVisualizationRef = useRef(null);
  const selectedLocationIds = (filters.locations || []).map(String);
  const selectedStaffIds = (filters.staff || []).map(String);
  const selectedStaff = analytics.staffOptions.find((staff) => selectedStaffIds.includes(String(staff.id)));
  const selectedLocation = locations.find((location) => (
    selectedLocationIds.includes(String(location.id)) ||
    (selectedStaffIds.length === 1 && String(location.id) === String(selectedStaff?.locationId))
  ));
  const dimensionConfig = dimension === "leadSources"
    ? {
      entityLabel: "Lead Source",
      entitiesLabel: "Lead Sources",
      selectedIds: (filters.leadSources || []).map(String),
      selectedName: leadSources.find((source) => (filters.leadSources || []).map(String).includes(String(source.id)))?.source_name,
    }
    : dimension === "staff"
      ? {
        entityLabel: "Staff",
        entitiesLabel: "Staff",
        selectedIds: selectedStaffIds,
        selectedName: selectedStaff?.name,
      }
      : {
        entityLabel: "Location",
        entitiesLabel: "Locations",
        selectedIds: selectedLocationIds,
        selectedName: selectedLocation?.location_name || user?.location_name,
      };
  const isSingleEntity = dimension === "locations"
    ? user?.role === "staff" || selectedLocationIds.length === 1 || selectedStaffIds.length === 1
    : dimensionConfig.selectedIds.length === 1;
  const singleEntityName = toTitleCaseWords(dimensionConfig.selectedName || `Selected ${dimensionConfig.entityLabel}`);
  const volumeOption = locationVolumeOptions.find((option) => option.value === (isSingleEntity ? "all" : volumeStatus));
  const performanceOption = locationPerformanceOptions.find((option) => option.value === performanceMetric);
  const rawVolumeItems = isSingleEntity
    ? analytics.volumeMetrics.map((metric) => {
      const option = locationVolumeOptions.find((item) => item.value === (metric.status === "scheduled" ? "booked" : metric.status === "no_show" ? "noShow" : metric.status));
      return { baseColor: option?.color || volumeOption.color, name: metric.label, value: Number(metric.value || 0) };
    })
    : (analytics.volumePerformanceRankings[dimension] || []).map((item) => ({
      name: item.name,
      value: Number(item[volumeStatus] || 0),
    })).sort((first, second) => second.value - first.value);
  const volumeTotal = rawVolumeItems.reduce((total, item) => total + item.value, 0);
  const largestVolume = Math.max(...rawVolumeItems.map((item) => item.value), 1);
  const volumeItems = rawVolumeItems.map((item) => ({
    ...item,
    color: getHeatColor(item.baseColor || volumeOption.color, item.value, largestVolume),
  }));
  const donutCircumference = 2 * Math.PI * 44;
  const donutSegments = volumeItems.reduce((segments, item) => {
    const length = volumeTotal ? (item.value / volumeTotal) * donutCircumference : 0;
    const visibleLength = Math.max(length - Math.min(2.2, length * 0.2), 0);
    const offset = segments.reduce((total, segment) => total + segment.length, 0);
    return [...segments, { ...item, length, offset, visibleLength }];
  }, []);
  const selectedVolumeItem = volumeItems.find((item) => item.name === selectedVolumeEntity) || null;
  const rawPerformanceItems = (analytics.rankings[dimension] || []).map((item) => ({
    ...getLocationPerformance(item, performanceMetric),
    name: item.name,
  })).filter((item) => item.value !== null).sort((first, second) => performanceMetric === "averageDays" ? first.value - second.value : second.value - first.value);
  const performanceMax = ["averageDays", "enrollments"].includes(performanceMetric)
    ? Math.max(...rawPerformanceItems.map((item) => item.value), 1)
    : 100;
  const performanceItems = rawPerformanceItems.map((item) => ({
    ...item,
    color: getHeatColor(performanceOption.color, item.value, performanceMax),
  }));
  const singleEntityRanking = analytics.rankings[dimension]?.[0] || null;
  const singleEntityPerformanceItems = singleEntityRanking
    ? locationPerformanceOptions.map((option) => ({
      ...getLocationPerformance(singleEntityRanking, option.value),
      color: option.color,
      label: option.label,
      metric: option.value,
    }))
    : [];
  const overallPerformanceValue = performanceMetric === "enrollments"
    ? analytics.metrics.find((metric) => metric.status === "enrolled")?.value ?? 0
    : performanceMetric === "averageDays"
      ? analytics.averageDaysToEnroll
      : performanceMetric === "noShow"
        ? analytics.rates.no_show
        : analytics.rates[performanceMetric];
  const formattedOverallPerformance = overallPerformanceValue === null
    ? "--"
    : performanceMetric === "averageDays"
      ? `${overallPerformanceValue} days`
      : performanceMetric === "enrollments"
        ? Number(overallPerformanceValue).toLocaleString()
        : `${overallPerformanceValue}%`;

  const toggleVolumeLocation = (name) => {
    setSelectedVolumeEntity((current) => current === name ? null : name);
  };

  useEffect(() => {
    const resetSelectionOutside = (event) => {
      if (!volumeVisualizationRef.current?.contains(event.target)) {
        setSelectedVolumeEntity(null);
      }
    };
    document.addEventListener("pointerdown", resetSelectionOutside);
    return () => document.removeEventListener("pointerdown", resetSelectionOutside);
  }, []);

  return (
    <section className="analytics-workspace analytics-location-comparison" aria-label={`${dimensionConfig.entityLabel} volume and performance comparison`}>
      <div className="analytics-location-comparison__grid">
        <section className="analytics-location-comparison__panel" aria-labelledby="location-volume-share-title">
          <header><div><h2 id="location-volume-share-title">{isSingleEntity ? `Status Mix · ${singleEntityName}` : `Volume Share by ${dimensionConfig.entityLabel}`}</h2><p>{isSingleEntity ? `Share of all status events for this ${dimensionConfig.entityLabel.toLowerCase()}` : "Share of selected-period events"}</p></div>{!isSingleEntity && <LocationChartPicker label="Status" onChange={(value) => { setVolumeStatus(value); setSelectedVolumeEntity(null); }} options={locationVolumeOptions} value={volumeStatus} />}</header>
          <div className="analytics-location-donut-layout">
            <div className={`analytics-location-donut${selectedVolumeItem ? " has-selection" : ""}`} ref={volumeVisualizationRef}>
              <svg aria-label={`${volumeOption.label}: ${volumeTotal} total events`} role="img" viewBox="0 0 100 100">
                <circle className="analytics-location-donut__track" cx="50" cy="50" r="44" />
                {donutSegments.map((item) => item.length > 0 && <circle aria-label={`${item.name}: ${item.value} events, ${((item.value / volumeTotal) * 100).toFixed(1)} percent`} className={`analytics-location-donut__segment${selectedVolumeEntity === item.name ? " is-selected" : ""}${selectedVolumeItem && selectedVolumeEntity !== item.name ? " is-muted" : ""}`} cx="50" cy="50" key={item.name} onClick={() => toggleVolumeLocation(item.name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggleVolumeLocation(item.name); }} r="44" role="button" stroke={item.color} strokeDasharray={`${item.visibleLength} ${donutCircumference - item.visibleLength}`} strokeDashoffset={-item.offset} tabIndex="0"><title>{item.name}: {item.value} ({((item.value / volumeTotal) * 100).toFixed(1)}%)</title></circle>)}
              </svg>
              <div><strong>{(selectedVolumeItem?.value ?? volumeTotal).toLocaleString()}</strong><span>{selectedVolumeItem?.name || volumeOption.label}</span>{selectedVolumeItem && <em>{((selectedVolumeItem.value / volumeTotal) * 100).toFixed(1)}%</em>}</div>
            </div>
            <ol className="analytics-location-donut__legend">{volumeItems.map((item) => <li key={item.name}><i style={{ background: item.color }} /><strong>{item.name}</strong><span>{item.value.toLocaleString()}</span><em>{volumeTotal ? `${((item.value / volumeTotal) * 100).toFixed(1)}%` : "0%"}</em></li>)}</ol>
          </div>
          <footer>{isSingleEntity || volumeStatus === "all" ? "All Events sums status events; it is not a unique-family count." : `${volumeOption.label} share across ${dimensionConfig.entitiesLabel.toLowerCase()}.`}</footer>
        </section>

        <section className={`analytics-location-comparison__panel analytics-location-comparison__panel--performance${isSingleEntity ? " analytics-location-comparison__panel--single" : ""}`} aria-labelledby="location-performance-title">
          <header><div><h2 id="location-performance-title">{isSingleEntity ? `${dimensionConfig.entityLabel} Performance · ${singleEntityName}` : `Performance by ${dimensionConfig.entityLabel}`}</h2><p>{isSingleEntity ? `All selected-period ${dimensionConfig.entityLabel.toLowerCase()} metrics` : `Independent ${dimensionConfig.entityLabel.toLowerCase()} results—not shares of a total`}</p></div>{!isSingleEntity && <LocationChartPicker label="Metric" onChange={setPerformanceMetric} options={locationPerformanceOptions} value={performanceMetric} />}</header>
          {!isSingleEntity && <div className="analytics-location-performance__overall" style={{ "--overall-color": performanceOption.color }}><span>Overall {performanceOption.label}</span><strong>{formattedOverallPerformance}</strong></div>}
          {isSingleEntity ? (
            <div className="analytics-location-metric-list">{singleEntityPerformanceItems.length ? singleEntityPerformanceItems.map((item) => <article key={item.metric} style={{ "--metric-color": item.color }}><i /><div><strong>{item.label}</strong><span>{item.detail}</span></div><b>{item.value === null ? "--" : item.metric === "averageDays" ? `${item.value} days` : item.metric === "enrollments" ? Number(item.value).toLocaleString() : `${item.value}%`}</b></article>) : <p>No {dimensionConfig.entityLabel.toLowerCase()} data for this period.</p>}</div>
          ) : (
            <div className="analytics-location-bars">{performanceItems.length ? performanceItems.map((item, index) => <article key={item.name}><b>{index + 1}</b><div><span><strong>{item.name}</strong><em>{item.detail}</em></span><div><i style={{ background: item.color, width: `${Math.max((item.value / performanceMax) * 100, item.value ? 2 : 0)}%` }} /></div></div><strong>{performanceMetric === "averageDays" ? `${item.value} days` : performanceMetric === "enrollments" ? item.value.toLocaleString() : `${item.value}%`}</strong></article>) : <p>No location data for this period.</p>}</div>
          )}
          <footer>{isSingleEntity ? "Rates use the scheduled-tour cohort · Volume uses event dates" : <>{performanceOption.label}{performanceMetric === "averageDays" ? " · Lower is faster" : " · Scheduled-tour cohort"}</>}</footer>
        </section>
      </div>
    </section>
  );
}

function formatRate(value) {
  return value === null ? "--" : `${value}%`;
}

function formatRankingValue(value, metric) {
  if (value === null) {
    return "--";
  }
  if (metric === "average_days") {
    return formatAverageDays(value);
  }
  if (metric === "enrollment") {
    return value.toLocaleString();
  }
  return `${value}%`;
}

function formatAverageDays(value) {
  if (value === null) {
    return "--";
  }
  return `${value} day${value === 1 ? "" : "s"}`;
}

function InfoHint({ label }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="analytics-info-wrap">
      <button
        aria-expanded={isOpen}
        aria-label={label}
        className="analytics-info-hint"
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen((current) => !current)}
        title={label}
        type="button"
      >
        <Info aria-hidden="true" />
      </button>
      {isOpen && (
        <span className="analytics-info-popover" role="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}

function RateCard({ delta, formula, label, tone, value, variant = "default" }) {
  return (
    <div className={`analytics-insight analytics-insight--${tone} analytics-insight--${variant}`}>
      <span className="analytics-insight__label">
        <span>{label}</span>
        <InfoHint label={formula} />
      </span>
      <strong>{formatRate(value)}</strong>
      <RateDeltaBadge delta={delta} />
    </div>
  );
}

function formatTrendLabel(startDate, endDate, mode) {
  if (mode === "monthly") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
    }).format(startDate);
  }

  if (startDate.toDateString() === endDate.toDateString()) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(startDate);
  }

  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(startDate)} - ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(endDate)}`;
}

function getTrendBucketWindows(chartData, mode, offset) {
  const dates = chartData
    .map((item) => parseDateInput(item.date))
    .filter(Boolean)
    .sort((first, second) => first - second);

  const baseEnd = dates[dates.length - 1] || new Date();

  if (mode === "monthly") {
    const end = addMonths(new Date(baseEnd.getFullYear(), baseEnd.getMonth(), 1), offset * 6);
    const start = addMonths(end, -5);
    return Array.from({ length: 6 }, (_, index) => {
      const bucketStart = addMonths(start, index);
      const bucketEnd = new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 0);
      return { start: bucketStart, end: bucketEnd };
    });
  }

  if (mode === "weekly") {
    const end = addDays(baseEnd, offset * 42);
    const start = addDays(end, -41);
    return Array.from({ length: 6 }, (_, index) => {
      const bucketStart = addDays(start, index * 7);
      return { start: bucketStart, end: addDays(bucketStart, 6) };
    });
  }

  const end = addDays(baseEnd, offset * 7);
  const start = addDays(end, -6);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index);
    return { start: day, end: day };
  });
}

function getTrendBuckets(chartData, mode, offset) {
  if (!chartData.length) {
    return [];
  }

  const windows = getTrendBucketWindows(chartData, mode, offset);
  const rows = chartData.map((item) => ({
    ...item,
    parsedDate: parseDateInput(item.date),
  })).filter((item) => item.parsedDate);

  return windows.map(({ start, end }) => {
    const items = rows.filter((item) => item.parsedDate >= start && item.parsedDate <= end);

    const booked = items.reduce((total, item) => total + item.booked, 0);
    const toured = items.reduce((total, item) => total + item.toured, 0);
    const enrolled = items.reduce((total, item) => total + item.enrolled, 0);

    return {
      booked,
      conversion: toured ? Math.round((enrolled / toured) * 100) : null,
      enrolled,
      label: formatTrendLabel(start, end, mode),
      toured,
    };
  });
}

// Retained temporarily while the replacement cohort visualization is validated.
// eslint-disable-next-line no-unused-vars
function TrendChart({ data }) {
  const [trendMode, setTrendMode] = useState("daily");
  const [trendOffset, setTrendOffset] = useState(0);
  const chartData = data.length ? data : [];
  const trendBuckets = getTrendBuckets(chartData, trendMode, trendOffset);
  const maxCount = Math.max(
    1,
    ...trendBuckets.flatMap((item) => [item.booked, item.toured, item.enrolled]),
  );
  const chartWidth = 720;
  const chartHeight = 300;
  const padding = { top: 32, right: 42, bottom: 58, left: 52 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const bucketWidth = plotWidth / Math.max(1, trendBuckets.length);
  const barWidth = Math.min(18, Math.max(7, bucketWidth / 7));
  const yTicks = [
    { label: String(maxCount), value: maxCount },
    { label: String(Math.round(maxCount / 2)), value: maxCount / 2 },
    { label: "0", value: 0 },
  ];

  function getCountY(value) {
    return padding.top + plotHeight - ((value / maxCount) * plotHeight);
  }

  function getRateY(value) {
    return padding.top + plotHeight - (((value ?? 0) / 100) * plotHeight);
  }

  const conversionPoints = trendBuckets
    .map((bucket, index) => {
      if (bucket.conversion === null) {
        return null;
      }
      const x = padding.left + (index * bucketWidth) + (bucketWidth / 2);
      return `${x},${getRateY(bucket.conversion)}`;
    })
    .filter(Boolean)
    .join(" ");

  function renderBar(bucket, index, key, className, offset) {
    const x = padding.left + (index * bucketWidth) + (bucketWidth / 2) + offset - (barWidth / 2);
    const y = getCountY(bucket[key]);
    const height = padding.top + plotHeight - y;
    const labelY = Math.max(padding.top + 12, y - 6);

    return (
      <g key={`${bucket.label}-${key}`}>
        <rect
          className={className}
          height={Math.max(0, height)}
          rx="4"
          width={barWidth}
          x={x}
          y={y}
        />
        {bucket[key] > 0 && (
          <text
            className="analytics-trend-chart__value"
            x={x + (barWidth / 2)}
            y={labelY}
          >
            {bucket[key]}
          </text>
        )}
      </g>
    );
  }

  return (
    <section className="analytics-panel analytics-trend" aria-label="Status trend">
      <div className="analytics-section-heading">
        <h3>Trend</h3>
        <div className="analytics-trend-controls" aria-label="Trend controls">
          <button
            aria-label="Previous timeline"
            onClick={() => setTrendOffset((current) => current - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <select
            aria-label="Trend grouping"
            onChange={(event) => {
              setTrendMode(event.target.value);
              setTrendOffset(0);
            }}
            value={trendMode}
          >
            {trendModeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            aria-label="Next timeline"
            onClick={() => setTrendOffset((current) => current + 1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="analytics-trend-chart" aria-label="Booked, toured, enrolled, and conversion trend">
        {trendBuckets.length ? (
          <svg role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            <line className="analytics-trend-chart__axis" x1={padding.left} x2={chartWidth - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} />
            <line className="analytics-trend-chart__axis" x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} />
            {yTicks.map((tick, index) => (
              <g key={`${tick.label}-${index}`}>
                <line
                  className="analytics-trend-chart__grid"
                  x1={padding.left}
                  x2={chartWidth - padding.right}
                  y1={getCountY(tick.value)}
                  y2={getCountY(tick.value)}
                />
                <text
                  className="analytics-trend-chart__y-label"
                  x={padding.left - 12}
                  y={getCountY(tick.value) + 4}
                >
                  {tick.label}
                </text>
              </g>
            ))}
            {trendBuckets.map((bucket, index) => (
              <g key={bucket.label}>
                {renderBar(bucket, index, "booked", "analytics-trend-chart__bar analytics-trend-chart__bar--booked", -barWidth * 1.25)}
                {renderBar(bucket, index, "toured", "analytics-trend-chart__bar analytics-trend-chart__bar--toured", 0)}
                {renderBar(bucket, index, "enrolled", "analytics-trend-chart__bar analytics-trend-chart__bar--enrolled", barWidth * 1.25)}
                <text className="analytics-trend-chart__label" x={padding.left + (index * bucketWidth) + (bucketWidth / 2)} y={chartHeight - 24}>
                  {bucket.label}
                </text>
              </g>
            ))}
            {conversionPoints && (
              <polyline className="analytics-trend-chart__line" points={conversionPoints} />
            )}
            {trendBuckets.map((bucket, index) => bucket.conversion !== null && (
              <g key={`${bucket.label}-conversion`}>
                <circle
                  className="analytics-trend-chart__point"
                  cx={padding.left + (index * bucketWidth) + (bucketWidth / 2)}
                  cy={getRateY(bucket.conversion)}
                  r="4"
                />
                <text
                  className="analytics-trend-chart__rate-label"
                  x={padding.left + (index * bucketWidth) + (bucketWidth / 2)}
                  y={Math.max(padding.top + 12, getRateY(bucket.conversion) - 10)}
                >
                  {bucket.conversion}%
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <p className="analytics-ranking__empty">No trend data for this period.</p>
        )}
      </div>
      <div className="analytics-trend-legend" aria-label="Trend legend">
        <span><i className="is-booked" />Booked</span>
        <span><i className="is-toured" />Toured</span>
        <span><i className="is-enrolled" />Enrolled</span>
        <span><i className="is-conversion" />Conversion rate</span>
      </div>
    </section>
  );
}

function TimeToProgress({ data }) {
  const displayedBuckets = data[0]?.buckets || progressDayBuckets;
  return (
    <section className="analytics-panel analytics-progress-time" aria-labelledby="progress-time-title">
      <div className="analytics-section-heading"><h3 id="progress-time-title">Time to Progress <InfoHint label={"Elapsed time between completed cohort milestones.\nBooked → Enrolled starts at the scheduled tour date."} /></h3></div>
      <div className="analytics-progress-time__table-wrap">
        <table className="analytics-progress-time__table">
          <thead><tr><th scope="col">Status change</th>{displayedBuckets.map((bucket) => <th key={bucket.label} scope="col"><span>{bucket.label.replace(" days", "")}</span><small>days</small></th>)}<th scope="col"><span>Average</span><small>days</small></th></tr></thead>
          <tbody>{data.map((transition) => { const isPrimary = ["booked_to_toured", "toured_to_enrolled", "booked_to_enrolled"].includes(transition.key); const starCount = transition.key === "booked_to_enrolled" ? 2 : isPrimary ? 1 : 0; return <tr key={transition.key}><th scope="row"><strong>{transition.label}{starCount > 0 && <span className="analytics-progress-time__stars" aria-label={starCount === 2 ? "Primary end-to-end transition" : "Primary transition"}>{Array.from({ length: starCount }, (_, index) => <Star aria-hidden="true" className="analytics-progress-time__star" key={index} />)}</span>}</strong><small>{transition.total} eligible</small></th>{transition.buckets.map((bucket) => <td className="analytics-progress-time__heat-cell" key={bucket.label} style={{ "--cell-intensity": `${Math.max(5, bucket.percent)}%` }}><strong>{bucket.count}</strong><small>{bucket.percent}%</small></td>)}<td className="analytics-progress-time__average"><div><strong>{transition.averageDays ?? "--"}</strong><span>{transition.averageDays === null || transition.averageDays === undefined ? "No data" : "days"}</span></div></td></tr>; })}</tbody>
        </table>
      </div>
    </section>
  );
}

const cohortRateTrendMetrics = {
  toured: { status: "toured", field: "touredRate", label: "Toured Rate", getCalculation: (row) => `${row.toured} toured / ${row.booked} booked` },
  conversion: { status: "conversion", field: "conversionRate", label: "Conversion Rate", getCalculation: (row) => `${row.enrolled} enrolled / ${row.toured} toured` },
  noShow: { status: "no_show", field: "noShowRate", label: "No Show Rate", getCalculation: (row) => `${row.noShow} no show / ${row.booked} booked` },
  close: { status: "close", field: "closeRate", label: "Closed Rate", getCalculation: (row) => `${Number(row.enrolled || 0) + Number(row.churned || 0)} closed / ${row.toured} toured` },
};

const temporalConversionMetricOptions = [
  { value: "conversion", label: "Conversion rate", numerator: "enrolled", denominator: "toured" },
  { value: "toured", label: "Toured rate", numerator: "toured", denominator: "booked" },
  { value: "no_show", label: "No-show rate", numerator: "noShow", denominator: "booked" },
  { value: "close", label: "Closed rate", numerator: "closed", denominator: "toured" },
  { value: "average_days", label: "Average days to Enrollment" },
];

function buildTemporalConversionGroups(rows, metric) {
  const dimensions = [
    { key: "quarter", title: "Quarter", describe: (date) => { const quarter = Math.floor(date.getMonth() / 3) + 1; return { key: String(quarter), label: `Q${quarter}` }; } },
    { key: "month", title: "Month", describe: (date) => ({ key: String(date.getMonth()), label: date.toLocaleDateString(undefined, { month: "long" }) }) },
    { key: "week", title: "Week of Month", describe: (date) => { const week = Math.ceil(date.getDate() / 7); return { key: String(week), label: `Week ${week}` }; } },
    { key: "dayOfMonth", title: "Day of Month", describe: (date) => ({ key: String(date.getDate()), label: ordinalDay(date.getDate()) }) },
    { key: "dayOfWeek", title: "Day of Week", describe: (date) => ({ key: String(date.getDay()), label: date.toLocaleDateString(undefined, { weekday: "long" }) }) },
  ];
  return dimensions.map((dimension) => {
    const buckets = new Map();
    rows.forEach((row) => {
      const descriptor = dimension.describe(new Date(`${row.date}T12:00:00`));
      const bucket = buckets.get(descriptor.key) || { ...descriptor, booked: 0, toured: 0, noShow: 0, enrolled: 0, churned: 0, averageDaysCount: 0, averageDaysTotal: 0 };
      ["booked", "toured", "noShow", "enrolled", "churned"].forEach((field) => { bucket[field] += Number(row[field] || 0); });
      const averageCount = Number(row.averageDaysCount || 0);
      bucket.averageDaysCount += averageCount;
      bucket.averageDaysTotal += Number(row.averageDaysToEnroll || 0) * averageCount;
      buckets.set(descriptor.key, bucket);
    });
    const entries = Array.from(buckets.values()).map((bucket) => {
      const closed = bucket.enrolled + bucket.churned;
      if (metric.value === "average_days") {
        return { ...bucket, value: bucket.averageDaysCount ? Math.round((bucket.averageDaysTotal / bucket.averageDaysCount) * 10) / 10 : null, detail: `${bucket.averageDaysCount} enrolled cohort${bucket.averageDaysCount === 1 ? "" : "s"}` };
      }
      const numerator = metric.numerator === "closed" ? closed : bucket[metric.numerator];
      const denominator = bucket[metric.denominator];
      return { ...bucket, value: getPercent(numerator, denominator), detail: `${numerator} ${metric.numerator === "noShow" ? "no show" : metric.numerator} / ${denominator} ${metric.denominator}` };
    });
    return { ...dimension, entries };
  });
}

function TemporalConversionRankings({ allTimeRows, rows }) {
  const [metricValue, setMetricValue] = useState("conversion");
  const [direction, setDirection] = useState("highest");
  const [scope, setScope] = useState("selected");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const metric = temporalConversionMetricOptions.find((option) => option.value === metricValue) || temporalConversionMetricOptions[0];
  const groups = buildTemporalConversionGroups(scope === "all" ? allTimeRows : rows, metric);
  const formatValue = (value) => value === null ? "--" : metric.value === "average_days" ? `${value} days` : `${value}%`;
  useEffect(() => {
    const dismissDropdown = (event) => document.querySelectorAll(".analytics-temporal-conversion-rankings .analytics-temporal-rankings__picker[open]").forEach((picker) => { if (!picker.contains(event.target)) picker.removeAttribute("open"); });
    document.addEventListener("pointerdown", dismissDropdown);
    return () => document.removeEventListener("pointerdown", dismissDropdown);
  }, []);
  return (
    <section className="analytics-temporal-rankings analytics-temporal-conversion-rankings" aria-labelledby="temporal-conversion-rankings-title">
      <div className="analytics-temporal-rankings__banner">
        <div className="analytics-temporal-rankings__title"><h2 id="temporal-conversion-rankings-title"><ArrowDownUp aria-hidden="true" /><span>Temporal Conversion Rankings</span><span className="analytics-temporal-rankings__mobile-info"><InfoHint label={`${metric.label}\nCohorts grouped by scheduled tour date\n${scope === "all" ? "All time" : "Selected period"}`} /></span></h2><span>{metric.label} · Cohorts by scheduled tour date · {scope === "all" ? "All time" : "Selected period"}</span></div>
        <div className="analytics-temporal-rankings__field"><details className="analytics-temporal-rankings__picker"><summary><span><small>Metric:</small><b>{metric.label}</b></span></summary><div>{temporalConversionMetricOptions.map((option) => <button className={metricValue === option.value ? "is-selected" : ""} key={option.value} onClick={(event) => { setMetricValue(option.value); event.currentTarget.closest("details")?.removeAttribute("open"); }} type="button"><span>{option.label}</span>{metricValue === option.value && <Check aria-hidden="true" />}</button>)}</div></details></div>
        <div className="analytics-temporal-rankings__scope"><span><CalendarDays aria-hidden="true" /><b>Selected period</b></span><button aria-checked={scope === "all"} aria-label="Toggle between selected period and all time" onClick={() => setScope((current) => current === "selected" ? "all" : "selected")} role="switch" type="button"><i /></button><span><InfinityIcon aria-hidden="true" /><b>All time</b></span></div>
        <div className="analytics-temporal-rankings__toggle"><button aria-label="Highest value" className={direction === "highest" ? "is-active" : ""} onClick={() => setDirection("highest")} type="button"><TrendingUp aria-hidden="true" /><span>Highest value</span></button><button aria-label="Lowest value" className={direction === "lowest" ? "is-active" : ""} onClick={() => setDirection("lowest")} type="button"><TrendingDown aria-hidden="true" /><span>Lowest value</span></button></div>
      </div>
      <div className="analytics-temporal-rankings__grid">{groups.map((group) => {
        const entries = [...group.entries].sort((first, second) => { if (first.value === null) return 1; if (second.value === null) return -1; return direction === "highest" ? second.value - first.value : first.value - second.value; });
        const topEntry = entries[0];
        const isExpanded = expandedGroup === group.key;
        return <article className={isExpanded ? "is-expanded" : ""} key={group.key}><button aria-expanded={isExpanded} className="analytics-temporal-rankings__card-heading" onClick={() => setExpandedGroup((current) => current === group.key ? null : group.key)} type="button"><h3>{group.title}</h3>{topEntry && <strong><span>{topEntry.label}</span><em>{formatValue(topEntry.value)}</em></strong>}<ChevronDown aria-hidden="true" /></button><span>{direction === "highest" ? "Highest value" : "Lowest value"}</span><TemporalDistributionPlot dimension={group.key} entries={group.entries.map((entry) => ({ ...entry, value: entry.value || 0 }))} status={metric.value === "average_days" ? "enrolled" : metric.value} /><ol>{entries.map((entry, index) => <li className={index === 0 ? "is-top" : ""} key={entry.key}><b>{index + 1}</b><strong><span>{entry.label}</span><small>{entry.detail}</small></strong><em>{formatValue(entry.value)}</em></li>)}</ol></article>;
      })}</div>
    </section>
  );
}

function buildCohortRateTrendRows(rows, mode) {
  const grouped = mode === "weekly" ? groupVolumeByWeek(rows) : mode === "monthly" ? groupVolumeByMonth(rows) : rows;
  return grouped.map((row) => ({
    ...row,
    touredRate: getPercent(row.toured, row.booked) ?? 0,
    noShowRate: getPercent(row.noShow, row.booked) ?? 0,
    closeRate: getPercent(Number(row.enrolled || 0) + Number(row.churned || 0), row.toured) ?? 0,
    conversionRate: getPercent(row.enrolled, row.toured) ?? 0,
  }));
}

function ConversionTrends({ data }) {
  const [mode, setMode] = useState("daily");
  const [selectedRates, setSelectedRates] = useState(["toured", "conversion"]);
  const [windowOffset, setWindowOffset] = useState(0);
  const availableRates = Object.values(cohortRateTrendMetrics);
  const selectedRateMetrics = availableRates.filter((metric) => selectedRates.includes(metric.status));
  const toggleRate = (status) => setSelectedRates((selected) => (
    selected.includes(status) ? selected.filter((item) => item !== status) : [...selected, status]
  ));
  const rows = buildCohortRateTrendRows(data, mode);
  const windowSize = mode === "daily" ? 14 : 12;
  const windowEnd = Math.max(0, rows.length - windowOffset);
  const windowStart = Math.max(0, windowEnd - windowSize);
  const visibleRows = rows.slice(windowStart, windowEnd);
  const canShowOlder = windowStart > 0;
  const canShowNewer = windowOffset > 0;
  const rangeLabel = visibleRows.length ? `${visibleRows[0].label || visibleRows[0].date} – ${visibleRows.at(-1).label || visibleRows.at(-1).date}` : "No dates available";
  useEffect(() => {
    const dismiss = (event) => document.querySelectorAll(".analytics-conversion-trends .analytics-volume-trend__picker[open]").forEach((picker) => { if (!picker.contains(event.target)) picker.removeAttribute("open"); });
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    <section className="analytics-volume-panel analytics-conversion-trends" aria-labelledby="conversion-trends-title">
      <div className="analytics-volume-trend__control-region">
        <div className="analytics-volume-panel__heading"><h2 id="conversion-trends-title">Conversion Trends</h2><div className="analytics-volume-trend__controls"><div className="analytics-volume-trend__field"><span>Timeline</span><details className="analytics-volume-trend__picker analytics-volume-trend__picker--timeline"><summary>{mode[0].toUpperCase() + mode.slice(1)}</summary><div>{["daily", "weekly", "monthly"].map((option) => <button className={mode === option ? "is-selected" : ""} key={option} onClick={(event) => { setMode(option); setWindowOffset(0); event.currentTarget.closest("details")?.removeAttribute("open"); }} type="button"><span>{option[0].toUpperCase() + option.slice(1)}</span>{mode === option && <Check aria-hidden="true" />}</button>)}</div></details></div><div className="analytics-volume-trend__field"><span>Rates</span><details className="analytics-volume-trend__picker"><summary>{selectedRates.length ? `${selectedRates.length} selected` : "Select rates"}</summary><div><div className="analytics-volume-trend__actions"><button onClick={() => setSelectedRates(availableRates.map((metric) => metric.status))} type="button">Select all</button><button onClick={() => setSelectedRates([])} type="button">Clear</button></div>{availableRates.map((metric) => <label key={metric.status}><input checked={selectedRates.includes(metric.status)} onChange={() => toggleRate(metric.status)} type="checkbox" /><i className={`is-${metric.status}`} />{metric.label}</label>)}</div></details></div></div></div>
        <div className="analytics-volume-trend__navigator"><button disabled={!canShowOlder} onClick={() => setWindowOffset((offset) => Math.min(rows.length, offset + windowSize))} type="button"><ChevronLeft aria-hidden="true" />Older</button><strong>{rangeLabel}</strong><button disabled={!canShowNewer} onClick={() => setWindowOffset((offset) => Math.max(0, offset - windowSize))} type="button">Newer<ChevronRight aria-hidden="true" /></button></div>
      </div>
      <div className="analytics-conversion-trends__charts">
        <section>
          {selectedRateMetrics.length ? <><div className="analytics-volume-trend__legend">{selectedRateMetrics.map((metric) => <span key={metric.status}><i className={`is-${metric.status}`} />{metric.label}</span>)}</div><VolumeTrendChart barStatuses={selectedRates.filter((status) => !["conversion", "no_show", "close"].includes(status))} curvedStatuses={["no_show"]} dottedStatuses={["close"]} fixedMax={100} metrics={selectedRateMetrics} pointStatuses={["conversion"]} rows={visibleRows} /></> : <div className="analytics-volume-trend__empty">Select at least one rate to view its trend.</div>}
        </section>
      </div>
    </section>
  );
}

function RankingSortControl({
  metric,
  onMetricChange,
  onScopeChange,
  onSortChange,
  scope,
  sort,
}) {
  const selectedMetric = rankingMetricOptions.find((option) => option.value === metric) || rankingMetricOptions[0];
  useEffect(() => {
    const dismissDropdown = (event) => document.querySelectorAll(".analytics-cohort-ranking-banner .analytics-temporal-rankings__picker[open]").forEach((picker) => { if (!picker.contains(event.target)) picker.removeAttribute("open"); });
    document.addEventListener("pointerdown", dismissDropdown);
    return () => document.removeEventListener("pointerdown", dismissDropdown);
  }, []);
  return (
    <div className="analytics-temporal-rankings__banner analytics-cohort-ranking-banner" aria-label="Cohort performance ranking controls">
      <div className="analytics-temporal-rankings__title"><h2><ArrowDownUp aria-hidden="true" /><span>Cohort Performance Rankings</span><span className="analytics-temporal-rankings__mobile-info"><InfoHint label={`${selectedMetric.label}\nCohorts by scheduled tour date\n${scope === "all" ? "All time" : "Selected period"}`} /></span></h2><span>{selectedMetric.label} · Cohorts by scheduled tour date · {scope === "all" ? "All time" : "Selected period"}</span></div>
      <div className="analytics-temporal-rankings__field"><details className="analytics-temporal-rankings__picker"><summary><span><small>Metric:</small><b>{selectedMetric.label}</b></span></summary><div>{rankingMetricOptions.map((option) => <button className={metric === option.value ? "is-selected" : ""} key={option.value} onClick={(event) => { onMetricChange(option.value); event.currentTarget.closest("details")?.removeAttribute("open"); }} type="button"><span>{option.label}</span>{metric === option.value && <Check aria-hidden="true" />}</button>)}</div></details></div>
      <div className="analytics-temporal-rankings__scope"><span><CalendarDays aria-hidden="true" /><b>Selected period</b></span><button aria-checked={scope === "all"} aria-label="Toggle between selected period and all time" onClick={() => onScopeChange(scope === "selected" ? "all" : "selected")} role="switch" type="button"><i /></button><span><InfinityIcon aria-hidden="true" /><b>All time</b></span></div>
      <div className="analytics-temporal-rankings__toggle">{rankingSortOptions.map((option) => <button aria-label={option.label} className={sort === option.value ? "is-active" : ""} key={option.value} onClick={() => onSortChange(option.value)} type="button">{option.value === "best" ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}<span>{option.label}</span></button>)}</div>
    </div>
  );
}

function RankingList({ items, metric, metricLabel, sortLabel, title }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const topItem = items[0];
  return (
    <section className={`analytics-panel analytics-ranking${isExpanded ? " is-expanded" : ""}`} aria-label={title}>
      <button aria-expanded={isExpanded} className="analytics-ranking__mobile-heading" onClick={() => setIsExpanded((current) => !current)} type="button"><strong>{title}</strong>{topItem && <span><b>{topItem.name}</b><em>{formatRankingValue(topItem.value, metric)}</em></span>}<ChevronDown aria-hidden="true" /></button>
      <div className="analytics-section-heading">
        <h3>{metricLabel} by {title}</h3>
        <p>{sortLabel}</p>
      </div>
      <div className="analytics-ranking__list">
        {items.length ? items.map((item, index) => (
          <article className="analytics-ranking__item" key={`${title}-${item.name}`}>
            <span className="analytics-ranking__rank">{index + 1}</span>
            <div>
              <strong>{item.name}</strong>
              {metric !== "average_days" && <small>{item.detail}</small>}
            </div>
            <span className={`analytics-ranking__rate ${item.value === null ? "is-empty" : ""}`}>
              {formatRankingValue(item.value, metric)}
            </span>
          </article>
        )) : (
          <p className="analytics-ranking__empty">No data for this period.</p>
        )}
      </div>
    </section>
  );
}

function Analytics({ view = "overview" }) {
  const { user } = useAuth();
  const { setAnalyticsLoading } = useOutletContext();
  const [filters, setFilters] = useState(() => createDefaultTourFilters(user));
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [tours, setTours] = useState([]);
  const [previousTours, setPreviousTours] = useState([]);
  const [cohortAnalytics, setCohortAnalytics] = useState(null);
  const [rankingMetric, setRankingMetric] = useState("conversion");
  const [rankingSort, setRankingSort] = useState("best");
  const [rankingScope, setRankingScope] = useState("selected");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setAnalyticsLoading(isLoading);
  }, [isLoading, setAnalyticsLoading]);

  useEffect(() => () => {
    setAnalyticsLoading(false);
  }, [setAnalyticsLoading]);

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

      try {
        const data = await getCohortAnalytics(buildAnalyticsParams(filters, rankingMetric, rankingSort));
        if (isCurrent) {
          setCohortAnalytics(data);
          setTours([]);
          setPreviousTours([]);
        }
      } catch {
        try {
          const { cohortTours, previousCohortTours } = await fetchLocalAnalyticsTours(filters);
          if (isCurrent) {
            setCohortAnalytics(null);
            setTours(cohortTours);
            setPreviousTours(previousCohortTours);
          }
        } catch {
          if (isCurrent) {
            setCohortAnalytics(null);
            setError("Unable to load analytics.");
          }
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
  }, [filters, rankingMetric, rankingSort]);

  const analytics = useMemo(() => {
    if (cohortAnalytics) {
      return adaptBackendCohortAnalytics(cohortAnalytics, rankingMetric);
    }

    const counts = countCohortProgress(tours);
    const previousCounts = countCohortProgress(previousTours);
    const canCompare = previousCounts.scheduled > 0;
    const metricList = analyticsStatuses.map(({ status, label }) => ({
        label,
        value: counts[status] || 0,
        delta: getDelta(counts[status] || 0, previousCounts[status] || 0, canCompare),
        status,
      }));

    const rates = {
      toured: getPercent(counts.toured, counts.scheduled),
      no_show: getPercent(counts.no_show, counts.scheduled),
      close: getPercent(counts.enrolled + counts.churned, counts.toured),
      conversion: getPercent(counts.enrolled, counts.toured),
    };
    const previousRates = {
      toured: getPercent(previousCounts.toured, previousCounts.scheduled),
      no_show: getPercent(previousCounts.no_show, previousCounts.scheduled),
      close: getPercent(previousCounts.enrolled + previousCounts.churned, previousCounts.toured),
      conversion: getPercent(previousCounts.enrolled, previousCounts.toured),
    };

    return {
      rankings: {
        locations: buildRanking(tours, ["location_name", "location"], rankingMetric),
        leadSources: buildRanking(tours, ["lead_source_name", "lead_source"], rankingMetric),
        staff: buildRanking(tours, ["assigned_staff_name", "staff_name", "assigned_staff", "created_by_name"], rankingMetric),
      },
      allTimeRankings: {
        locations: buildRanking(tours, ["location_name", "location"], rankingMetric),
        leadSources: buildRanking(tours, ["lead_source_name", "lead_source"], rankingMetric),
        staff: buildRanking(tours, ["assigned_staff_name", "staff_name", "assigned_staff", "created_by_name"], rankingMetric),
      },
      volumePerformanceRankings: {
        locations: buildLocalVolumePerformanceRanking(tours, filters, ["location_name", "location"]),
        leadSources: buildLocalVolumePerformanceRanking(tours, filters, ["lead_source_name", "lead_source"]),
        staff: buildLocalVolumePerformanceRanking(tours, filters, ["assigned_staff_name", "staff_name", "assigned_staff", "created_by_name"]),
      },
      allTimeVolumePerformanceRankings: {
        locations: buildLocalVolumePerformanceRanking(tours, { ...filters, date_range: "all", date_from: "", date_to: "" }, ["location_name", "location"]),
        leadSources: buildLocalVolumePerformanceRanking(tours, { ...filters, date_range: "all", date_from: "", date_to: "" }, ["lead_source_name", "lead_source"]),
        staff: buildLocalVolumePerformanceRanking(tours, { ...filters, date_range: "all", date_from: "", date_to: "" }, ["assigned_staff_name", "staff_name", "assigned_staff", "created_by_name"]),
      },
      staffOptions: Array.from(new Map(tours.filter((tour) => tour.assigned_staff).map((tour) => [String(tour.assigned_staff), { id: tour.assigned_staff, name: tour.assigned_staff_name || tour.staff_name || "Staff" }])).values()),
      trendData: getCohortRateTrendData(tours, filters),
      allTimeTrendData: getCohortRateTrendData(tours, { ...filters, date_range: "all", date_from: "", date_to: "" }),
      timeToProgress: buildTimeToProgress(tours, previousTours, getProgressDayBuckets(filters)),
      volumeTrendData: getTrendData(tours, filters),
      previousVolumeTrendData: getTrendData(previousTours, filters),
      volumeHeatmap: [],
      volumeCalendarData: getTrendData(tours, filters),
      allTimeVolumeCalendarData: getTrendData(tours, filters),
      metrics: metricList,
      volumeMetrics: metricList.map((metric) => ({ ...metric, previousValue: previousCounts[metric.status] || 0 })),
      pendingOutcomes: countPendingOutcomes(tours),
      averageDaysToEnroll: getAverageDaysToEnroll(tours),
      rates,
      rateDeltas: {
        toured: getRateDelta(rates.toured, previousRates.toured, canCompare),
        no_show: getRateDelta(rates.no_show, previousRates.no_show, canCompare),
        close: getRateDelta(rates.close, previousRates.close, canCompare),
        conversion: getRateDelta(rates.conversion, previousRates.conversion, canCompare),
      },
    };
  }, [cohortAnalytics, filters, previousTours, rankingMetric, tours]);

  const metricByStatus = useMemo(() => (
    analytics.metrics.reduce((summary, metric) => ({
      ...summary,
      [metric.status]: metric,
    }), {})
  ), [analytics.metrics]);

  const periodComparison = useMemo(() => {
    const selectedRange = getDateRange(filters);
    const previousRange = getPreviousComparableRange(filters, selectedRange);
    return {
      selected: filters.datePreset === "all_time" ? "All Time" : formatDisplayRange(selectedRange),
      previous: previousRange ? formatDisplayRange(previousRange) : "",
    };
  }, [filters]);

  const sortedRankings = useMemo(() => {
    const source = rankingScope === "all" ? analytics.allTimeRankings : analytics.rankings;
    return {
      locations: sortRanking(source.locations, rankingSort),
      leadSources: sortRanking(source.leadSources, rankingSort),
      staff: sortRanking(source.staff, rankingSort),
    };
  }, [analytics.allTimeRankings, analytics.rankings, rankingScope, rankingSort]);

  const rankingSortLabel = rankingSort === "worst" ? "Least performing" : "Best performing";
  const rankingMetricLabel = rankingMetricOptions.find((option) => option.value === rankingMetric)?.label || "Conversion rate";

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
      ...(name === "locations" ? { staff: [] } : {}),
    }));
  }

  return (
    <section className="analytics-page" aria-label="Analytics">
      <TourFilterControls
        filters={filters}
        leadSources={leadSources}
        locations={locations}
        staff={analytics.staffOptions}
        onChange={updateFilter}
        showSearch={false}
        showStaff
        showStatus={false}
        staffLocationLabel={user?.location_name}
        staffLocationOnly={user?.role === "staff"}
      />

      {error && <p className="analytics-state analytics-state--error">{error}</p>}
      {view === "overview" ? (
        <section className="analytics-workspace analytics-workspace--overview" aria-label="Analytics overview">
          <div className="analytics-overview-header">
            <div className="analytics-period">
              <strong>{periodComparison.selected}</strong>
              {periodComparison.previous && (
                <span>vs {periodComparison.previous}</span>
              )}
            </div>
          </div>

          <section className="analytics-overview-section" aria-labelledby="analytics-overview-volume">
            <div className="analytics-overview-section__title">
              <h3 id="analytics-overview-volume">Volume and Trend Analysis</h3>
              <InfoHint label={"• Date = event date\n• Booked uses creation date"} />
              <Link to="/analytics/volume">Explore more</Link>
            </div>
            <div className="analytics-overview-grid" aria-label="Selected period volume">
              {analytics.volumeMetrics.map((metric) => (
                <OverviewMetricCard
                  delta={metric.delta}
                  isKeyMetric={metric.status === "enrolled"}
                  key={metric.status}
                  label={metric.label}
                  status={metric.status}
                  trendValues={getOverviewTrendValues(analytics.volumeTrendData, metric.status)}
                  value={metric.value}
                />
              ))}
            </div>
          </section>

          <section className="analytics-overview-section" aria-labelledby="analytics-overview-performance">
            <div className="analytics-overview-section__title">
              <h3 id="analytics-overview-performance">Conversion and Cohort Analysis</h3>
              <InfoHint label={"• Date = scheduled tour date\n• Later outcomes stay with the cohort"} />
              <Link to="/analytics/cohort">Explore more</Link>
            </div>
            <div className="analytics-overview-performance-grid">
              <OverviewPerformanceCard
                delta={analytics.rateDeltas?.toured}
                info="Toured Rate = Toured ÷ Booked"
                label="Toured Rate"
                tone="toured"
                value={analytics.rates.toured}
              />
              <OverviewPerformanceCard
                delta={analytics.rateDeltas?.close}
                info="Close Rate = (Enrolled + Churned) ÷ Toured"
                label="Close Rate"
                tone="close"
                value={analytics.rates.close}
              />
              <OverviewPerformanceCard
                delta={analytics.rateDeltas?.no_show}
                info="No Show Rate = No Show ÷ Booked"
                label="No Show Rate"
                tone="no-show"
                value={analytics.rates.no_show}
              />
              <OverviewPerformanceCard
                delta={analytics.rateDeltas?.conversion}
                info="Conversion Rate = Enrolled ÷ Toured"
                isKeyMetric
                label="Conversion Rate"
                tone="conversion"
                value={analytics.rates.conversion}
              />
              <OverviewPerformanceCard
                info="Avg. Days to Enroll = Σ(Enrollment Date − Tour Date) ÷ Enrollments"
                label="Avg. Days to Enroll"
                tone="average"
                value={analytics.averageDaysToEnroll}
                valueKind="days"
              />
            </div>
          </section>

          <section className="analytics-overview-section" aria-labelledby="analytics-overview-performance-insights">
            <div className="analytics-overview-section__title">
              <h3 id="analytics-overview-performance-insights">Performance Insights</h3>
              <InfoHint label={"• Ranked by Conversion Rate\n• Enrolled ÷ Toured\n• Date = scheduled tour date"} />
            </div>
            <div className="analytics-overview-links" aria-label="Performance insight summaries">
              <OverviewFinancialCard items={analytics.rankings.locations} />
              <OverviewRankingCard icon={MapPin} items={sortedRankings.locations} metric={rankingMetric} path="/analytics/locations" title="Location Analytics" />
              <OverviewRankingCard icon={Megaphone} items={sortedRankings.leadSources} metric={rankingMetric} path="/analytics/lead-sources" title="Lead Source Analytics" />
              <OverviewRankingCard icon={UsersRound} items={sortedRankings.staff} metric={rankingMetric} path="/analytics/staff" title="Staff Analytics" />
            </div>
          </section>
        </section>
      ) : view === "volume" ? (
        <VolumeAnalyticsWorkspace analytics={analytics} key={periodComparison.selected} periodComparison={periodComparison} />
      ) : ["locations", "leadSources", "staff"].includes(view) ? (
        <EntityAnalyticsWorkspace analytics={analytics} dimension={view} filters={filters} leadSources={leadSources} locations={locations} user={user} />
      ) : (
        <section className="analytics-workspace" aria-label="Cohort analytics">
          <div className="analytics-period">
            <strong>{periodComparison.selected}</strong>
            {periodComparison.previous && (
              <span>vs {periodComparison.previous}</span>
            )}
          </div>

          <div className="analytics-summary-grid">
            <section className="analytics-flow" aria-label="Enrollment analytics flow">
              <div className="analytics-flow__stage analytics-flow__stage--entry">
                <MetricNode {...metricByStatus.scheduled} />
              </div>

              <div className="analytics-flow__branch">
                <div className="analytics-flow__branch-header">
                  <span>Booked outcomes</span>
                </div>
                <div className="analytics-flow__branch-grid">
                  <MetricNode {...metricByStatus.toured} />
                  <MetricNode {...metricByStatus.no_show} />
                </div>
              </div>

              <div className="analytics-flow__branch">
                <div className="analytics-flow__branch-header">
                  <span>Toured outcomes</span>
                </div>
                <div className="analytics-flow__branch-grid">
                  <MetricNode {...metricByStatus.enrolled} />
                  <MetricNode {...metricByStatus.churned} />
                </div>
              </div>
            </section>

            <aside className="analytics-insights" aria-label="Analytics rates">
              <div className="analytics-rate-stack">
                <RateCard
                  delta={analytics.rateDeltas.toured}
                  formula={"Toured ÷ Booked.\nCompared with previous period."}
                  label="Toured rate"
                  tone="toured"
                  value={analytics.rates.toured}
                />
                <RateCard
                  delta={analytics.rateDeltas.no_show}
                  formula={"No Show ÷ Booked.\nCompared with previous period."}
                  label="No show rate"
                  tone="no-show"
                  value={analytics.rates.no_show}
                />
                <RateCard
                  delta={analytics.rateDeltas.close}
                  formula={"(Enrolled + Churned) ÷ Toured.\nCompared with previous period."}
                  label="Close rate"
                  tone="close"
                  value={analytics.rates.close}
                />
              </div>
              <RateCard
                delta={analytics.rateDeltas.conversion}
                formula={"Enrolled ÷ Toured.\nCompared with previous period."}
                label="Conversion rate"
                tone="conversion"
                value={analytics.rates.conversion}
                variant="featured"
              />
              <div className="analytics-secondary-metrics">
                <div className="analytics-insight analytics-insight--average">
                  <span className="analytics-insight__label">
                    <span>Average days to enroll</span>
                    <InfoHint label={"Tour date to enrolled date.\nAverage across enrolled tours."} />
                  </span>
                  <strong>{formatAverageDays(analytics.averageDaysToEnroll)}</strong>
                </div>
                <div className="analytics-insight analytics-insight--active">
                  <span className="analytics-insight__label">
                    <span>Pending Toured / No Show</span>
                    <InfoHint label={"Booked tours past tour date.\nMissing toured or no-show outcome."} />
                  </span>
                  <strong>{analytics.pendingOutcomes.pendingTourOutcome}</strong>
                </div>
                <div className="analytics-insight analytics-insight--active">
                  <span className="analytics-insight__label">
                    <span>Pending Enrolled / Churned</span>
                    <InfoHint label={"Toured families past follow-up window.\nMissing enrolled or churned outcome."} />
                  </span>
                  <strong>{analytics.pendingOutcomes.pendingEnrollmentOutcome}</strong>
                </div>
              </div>
            </aside>
          </div>

          <ConversionTrends data={analytics.trendData} />

          <TemporalConversionRankings allTimeRows={analytics.allTimeTrendData} rows={analytics.trendData} />

          <TimeToProgress data={analytics.timeToProgress} />

          <RankingSortControl
            metric={rankingMetric}
            onMetricChange={setRankingMetric}
            onScopeChange={setRankingScope}
            onSortChange={setRankingSort}
            scope={rankingScope}
            sort={rankingSort}
          />

          <div className="analytics-ranking-grid" aria-label="Conversion rankings">
            <RankingList items={sortedRankings.locations} metric={rankingMetric} metricLabel={rankingMetricLabel} sortLabel={rankingSortLabel} title="Location" />
            <RankingList items={sortedRankings.leadSources} metric={rankingMetric} metricLabel={rankingMetricLabel} sortLabel={rankingSortLabel} title="Lead Source" />
            <RankingList items={sortedRankings.staff} metric={rankingMetric} metricLabel={rankingMetricLabel} sortLabel={rankingSortLabel} title="Staff" />
          </div>
        </section>
      )}
    </section>
  );
}

export default Analytics;
