import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import TourFilterControls from "../../components/filters/TourFilterControls";
import useAuth from "../../features/auth/useAuth";
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
  { value: "conversion", label: "Conversion rate" },
  { value: "close", label: "Close rate" },
  { value: "toured", label: "Toured rate" },
  { value: "enrollment", label: "Enrollments" },
  { value: "average_days", label: "Average days to enrollment" },
  { value: "margin", label: "Contribution margin" },
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
    return `${item.enrolled} enrolled / ${item.booked} booked`;
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

function DeltaBadge({ delta }) {
  if (!delta || delta.difference === 0) {
    return null;
  }
  const isIncrease = delta.difference > 0;
  const Icon = isIncrease ? TrendingUp : TrendingDown;
  const sign = isIncrease ? "+" : "";

  return (
    <span className={`analytics-delta analytics-delta--${isIncrease ? "up" : "down"}`}>
      <Icon aria-hidden="true" />
      <span>
        {sign}{delta.difference}
        {delta.percent !== null && ` (${sign}${delta.percent}%)`}
      </span>
    </span>
  );
}

function RateDeltaBadge({ delta }) {
  if (delta === null || delta === 0) {
    return null;
  }
  const isIncrease = delta > 0;
  const Icon = isIncrease ? TrendingUp : TrendingDown;
  const sign = isIncrease ? "+" : "";

  return (
    <span className={`analytics-rate-delta analytics-rate-delta--${isIncrease ? "up" : "down"}`}>
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

function formatCompactDate(value) {
  const date = parseDateInput(value);
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getTrendBuckets(chartData) {
  if (!chartData.length) {
    return [];
  }

  const bucketCount = Math.min(6, Math.max(1, Math.ceil(chartData.length / 5)));
  const bucketSize = Math.ceil(chartData.length / bucketCount);

  return Array.from({ length: bucketCount }, (_, index) => {
    const items = chartData.slice(index * bucketSize, (index + 1) * bucketSize);
    if (!items.length) {
      return null;
    }

    const booked = items.reduce((total, item) => total + item.booked, 0);
    const toured = items.reduce((total, item) => total + item.toured, 0);
    const enrolled = items.reduce((total, item) => total + item.enrolled, 0);
    const label = items.length === 1
      ? formatCompactDate(items[0].date)
      : `${formatCompactDate(items[0].date)} - ${formatCompactDate(items[items.length - 1].date)}`;

    return {
      booked,
      conversion: toured ? Math.round((enrolled / toured) * 100) : null,
      enrolled,
      label,
      toured,
    };
  }).filter(Boolean);
}

function TrendBar({ label, max, tone, value }) {
  const width = max ? Math.max(4, Math.round((value / max) * 100)) : 0;

  return (
    <div className="analytics-trend-bar">
      <span className="analytics-trend-bar__row">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <span className="analytics-trend-bar__track" aria-hidden="true">
        <span
          className={`analytics-trend-bar__fill analytics-trend-bar__fill--${tone}`}
          style={{ width: `${width}%` }}
        />
      </span>
    </div>
  );
}

function TrendChart({ data }) {
  const chartData = data.length ? data : [];
  const trendBuckets = getTrendBuckets(chartData);
  const maxCount = Math.max(
    1,
    ...trendBuckets.flatMap((item) => [item.booked, item.toured, item.enrolled]),
  );

  return (
    <section className="analytics-panel analytics-trend" aria-label="Status trend">
      <div className="analytics-section-heading">
        <h3>Trend</h3>
        <p>Grouped period view for booked, toured, enrolled, and conversion.</p>
      </div>
      <div className="analytics-trend__cards" aria-label="Grouped trend chart">
        {trendBuckets.length ? trendBuckets.map((bucket) => (
          <article className="analytics-trend-card" key={bucket.label}>
            <strong>{bucket.label}</strong>
            <TrendBar label="Booked" max={maxCount} tone="booked" value={bucket.booked} />
            <TrendBar label="Toured" max={maxCount} tone="toured" value={bucket.toured} />
            <TrendBar label="Enrolled" max={maxCount} tone="enrolled" value={bucket.enrolled} />
            <span className="analytics-trend-card__conversion">
              {bucket.conversion === null ? "--" : `${bucket.conversion}%`} conversion
            </span>
          </article>
        )) : (
          <p className="analytics-ranking__empty">No trend data for this period.</p>
        )}
      </div>
    </section>
  );
}

function RankingSortControl({
  metric,
  onMetricChange,
  onSortChange,
  sort,
}) {
  const [isMetricOpen, setIsMetricOpen] = useState(false);
  const selectedMetric = rankingMetricOptions.find((option) => option.value === metric) || rankingMetricOptions[0];

  function closeMetricMenu(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsMetricOpen(false);
    }
  }

  return (
    <div className="analytics-ranking-sort" aria-label="Ranking sort">
      <span>
        <ArrowDownUp aria-hidden="true" />
        Rankings
      </span>
      <div className="analytics-ranking-sort__select" onBlur={closeMetricMenu}>
        <small>Metric</small>
        <button
          aria-expanded={isMetricOpen}
          aria-haspopup="listbox"
          className="analytics-ranking-sort__trigger"
          onClick={() => setIsMetricOpen((current) => !current)}
          type="button"
        >
          <span>{selectedMetric.label}</span>
          <ChevronDown aria-hidden="true" />
        </button>
        {isMetricOpen && (
          <div className="analytics-ranking-sort__menu" role="listbox">
            {rankingMetricOptions.map((option) => (
              <button
                aria-selected={metric === option.value}
                className={metric === option.value ? "is-active" : ""}
                key={option.value}
                onClick={() => {
                  onMetricChange(option.value);
                  setIsMetricOpen(false);
                }}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                {metric === option.value && <Check aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="analytics-ranking-sort__buttons">
        {rankingSortOptions.map((option) => (
          <button
            aria-pressed={sort === option.value}
            className={sort === option.value ? "is-active" : ""}
            key={option.value}
            onClick={() => onSortChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RankingList({ items, metric, metricLabel, sortLabel, title }) {
  return (
    <section className="analytics-panel analytics-ranking" aria-label={title}>
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
              <small>{item.detail}</small>
            </div>
            <span className={`analytics-ranking__rate ${item.value === null ? "is-empty" : ""}`}>
              {formatRankingValue(item.value, metric)}
            </span>
          </article>
        )) : (
          <p className="analytics-ranking__empty">No conversion data for this period.</p>
        )}
      </div>
    </section>
  );
}

function Analytics() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(() => createDefaultTourFilters(user));
  const [locations, setLocations] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [tours, setTours] = useState([]);
  const [previousTours, setPreviousTours] = useState([]);
  const [costBasis, setCostBasis] = useState("");
  const [rankingMetric, setRankingMetric] = useState("conversion");
  const [rankingSort, setRankingSort] = useState("best");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
      const dateRange = getDateRange(filters);
      const previousDateRange = getPreviousComparableRange(filters, dateRange);
      const commonParams = {
        location: joinFilterValues(filters.locations),
        lead_source: joinFilterValues(filters.leadSources),
        status: joinFilterValues(filters.statuses),
      };

      try {
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

        if (isCurrent) {
          const [cohortTours, previousCohortTours] = await Promise.all([
            attachEventsToTours(tourData),
            attachEventsToTours(previousTourData),
          ]);
          if (isCurrent) {
            setTours(cohortTours);
            setPreviousTours(previousCohortTours);
          }
        }
      } catch {
        if (isCurrent) {
          setError("Unable to load analytics.");
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
  }, [filters]);

  const analytics = useMemo(() => {
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
      trendData: getTrendData(tours, filters),
      metrics: metricList,
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
  }, [filters, previousTours, rankingMetric, tours]);

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
      selected: formatDisplayRange(selectedRange),
      previous: previousRange ? formatDisplayRange(previousRange) : "",
    };
  }, [filters]);

  const sortedRankings = useMemo(() => ({
    locations: sortRanking(analytics.rankings.locations, rankingSort),
    leadSources: sortRanking(analytics.rankings.leadSources, rankingSort),
    staff: sortRanking(analytics.rankings.staff, rankingSort),
  }), [analytics.rankings, rankingSort]);

  const rankingSortLabel = rankingSort === "worst" ? "Least performing" : "Best performing";
  const rankingMetricLabel = rankingMetricOptions.find((option) => option.value === rankingMetric)?.label || "Conversion rate";

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  return (
    <section className="analytics-page" aria-label="Analytics">
      <TourFilterControls
        filters={filters}
        leadSources={leadSources}
        locations={locations}
        onChange={updateFilter}
        showCostBasis
        showSearch={false}
        showStatus={false}
        costBasis={costBasis}
        onCostBasisChange={setCostBasis}
        staffLocationLabel={user?.location_name}
        staffLocationOnly={user?.role === "staff"}
      />

      {error && <p className="analytics-state analytics-state--error">{error}</p>}
      {isLoading && <p className="analytics-state">Loading analytics...</p>}

      <section className="analytics-workspace" aria-label="Enrollment analytics">
        <div className="analytics-period">
          <strong>{periodComparison.selected}</strong>
          {periodComparison.previous && (
            <span>vs {periodComparison.previous}</span>
          )}
        </div>

        <div className="analytics-summary-grid">
          <section className="analytics-flow" aria-label="Enrollment analytics flow">
            <MetricNode {...metricByStatus.scheduled} className="analytics-flow-node--booked-position analytics-flow-node--with-down-arrow" />
            <span className="analytics-flow__arrow analytics-flow__arrow--top" aria-hidden="true">↘</span>
            <MetricNode {...metricByStatus.no_show} className="analytics-flow-node--no-show-position" />
            <MetricNode {...metricByStatus.toured} className="analytics-flow-node--toured-position analytics-flow-node--with-down-arrow" />
            <span className="analytics-flow__arrow analytics-flow__arrow--bottom" aria-hidden="true">↘</span>
            <MetricNode {...metricByStatus.churned} className="analytics-flow-node--churned-position" />
            <MetricNode {...metricByStatus.enrolled} className="analytics-flow-node--enrolled-position" />
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

        <TrendChart data={analytics.trendData} />

        <RankingSortControl
          metric={rankingMetric}
          onMetricChange={setRankingMetric}
          onSortChange={setRankingSort}
          sort={rankingSort}
        />

        <div className="analytics-ranking-grid" aria-label="Conversion rankings">
          <RankingList items={sortedRankings.locations} metric={rankingMetric} metricLabel={rankingMetricLabel} sortLabel={rankingSortLabel} title="Location" />
          <RankingList items={sortedRankings.leadSources} metric={rankingMetric} metricLabel={rankingMetricLabel} sortLabel={rankingSortLabel} title="Lead Source" />
          <RankingList items={sortedRankings.staff} metric={rankingMetric} metricLabel={rankingMetricLabel} sortLabel={rankingSortLabel} title="Staff" />
        </div>
      </section>
    </section>
  );
}

export default Analytics;
