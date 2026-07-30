import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronDown, MapPin, Minus, SlidersHorizontal } from "lucide-react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { getCohortAnalytics } from "../../features/analytics/analyticsApi";
import { getLocations } from "../../features/tours/tourApi";
import { AnalyticsExport, useAnalyticsDrillThrough } from "./AnalyticsActions";
import "./Analytics.css";

function monthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value, amount) {
  const [year, month] = value.split("-").map(Number);
  return monthValue(new Date(year, month - 1 + amount, 1));
}

function monthRange(startMonth, endMonth) {
  const [startYear, startNumber] = startMonth.split("-").map(Number);
  const [endYear, endNumber] = endMonth.split("-").map(Number);
  const endDate = new Date(endYear, endNumber, 0);
  return {
    date_from: `${startMonth}-01`,
    date_to: `${endYear}-${String(endNumber).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`,
    monthCount: ((endYear - startYear) * 12) + endNumber - startNumber + 1,
  };
}

function formatMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function CostsMarginFilters({ compareEnd, compareIsCustom, compareStart, endMonth, latestCompletedMonth, location, locations, onCompareEndChange, onCompareReset, onCompareStartChange, onEndChange, onLocationChange, onStartChange, selectedMonthCount, startMonth }) {
  const [openFilter, setOpenFilter] = useState("");
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const filtersRef = useRef(null);
  const monthOptions = useMemo(() => Array.from({ length: 60 }, (_, index) => shiftMonth(latestCompletedMonth, -index)), [latestCompletedMonth]);
  const selectedLocation = locations.find((item) => String(item.id) === String(location));

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!filtersRef.current?.contains(event.target)) {
        setOpenFilter("");
        setIsMobilePanelOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  function toggleFilter(name) {
    setOpenFilter((current) => current === name ? "" : name);
  }

  return (
    <section className="costs-margin-filters" aria-label="Costs & Margin filters" ref={filtersRef}>
      <button aria-expanded={isMobilePanelOpen} aria-label={isMobilePanelOpen ? "Close filters" : "Open filters"} className="costs-margin-filters__master" onClick={() => { setIsMobilePanelOpen((current) => !current); setOpenFilter(""); }} type="button"><SlidersHorizontal aria-hidden="true" /><span>Filters</span><strong>3</strong></button>
      <div className={`costs-margin-filters__controls ${isMobilePanelOpen ? "is-mobile-open" : ""}`}>
      <div className={`costs-margin-filter ${openFilter === "period" ? "is-open" : ""}`}>
        <button aria-expanded={openFilter === "period"} className="costs-margin-filter__trigger" onClick={() => toggleFilter("period")} type="button">
          <CalendarDays aria-hidden="true" /><span><small>Completed months</small><strong>{formatMonth(startMonth)} – {formatMonth(endMonth)}</strong></span><ChevronDown aria-hidden="true" />
        </button>
        {openFilter === "period" && <div className="costs-margin-filter__menu costs-margin-filter__menu--months">
          <div><strong>Start month</strong><div className="costs-margin-filter__options">{monthOptions.map((month) => <button className={month === startMonth ? "is-selected" : ""} disabled={month > endMonth} key={`start-${month}`} onClick={() => onStartChange(month)} type="button">{formatMonth(month)}{month === startMonth && <Check aria-hidden="true" />}</button>)}</div></div>
          <div><strong>End month</strong><div className="costs-margin-filter__options">{monthOptions.map((month) => <button className={month === endMonth ? "is-selected" : ""} disabled={month < startMonth} key={`end-${month}`} onClick={() => onEndChange(month)} type="button">{formatMonth(month)}{month === endMonth && <Check aria-hidden="true" />}</button>)}</div></div>
        </div>}
      </div>

      <div className={`costs-margin-filter ${openFilter === "comparison" ? "is-open" : ""}`}>
        <button aria-expanded={openFilter === "comparison"} className="costs-margin-filter__trigger" onClick={() => toggleFilter("comparison")} type="button">
          <CalendarDays aria-hidden="true" /><span><small>Months to compare{compareIsCustom ? " · Custom" : " · Previous period"}</small><strong>{formatMonth(compareStart)} – {formatMonth(compareEnd)}</strong></span><ChevronDown aria-hidden="true" />
        </button>
        {openFilter === "comparison" && <div className="costs-margin-filter__menu costs-margin-filter__menu--months costs-margin-filter__menu--comparison">
          <div className="costs-margin-filter__menu-header"><span>Comparison must match the selected {selectedMonthCount}-month period.</span>{compareIsCustom && <button className="costs-margin-filter__reset" onClick={onCompareReset} type="button">Reset to previous period</button>}</div>
          <div><strong>Start month</strong><div className="costs-margin-filter__options">{monthOptions.map((month) => {
            const disabled = shiftMonth(month, selectedMonthCount - 1) > latestCompletedMonth;
            return <button className={month === compareStart ? "is-selected" : ""} disabled={disabled} key={`compare-start-${month}`} onClick={() => onCompareStartChange(month)} type="button">{formatMonth(month)}{month === compareStart && <Check aria-hidden="true" />}</button>;
          })}</div></div>
          <div><strong>End month</strong><div className="costs-margin-filter__options">{monthOptions.map((month) => <button className={month === compareEnd ? "is-selected" : ""} key={`compare-end-${month}`} onClick={() => onCompareEndChange(month)} type="button">{formatMonth(month)}{month === compareEnd && <Check aria-hidden="true" />}</button>)}</div></div>
        </div>}
      </div>

      <div className={`costs-margin-filter ${openFilter === "location" ? "is-open" : ""}`}>
        <button aria-expanded={openFilter === "location"} className="costs-margin-filter__trigger" onClick={() => toggleFilter("location")} type="button">
          <MapPin aria-hidden="true" /><span><small>Location</small><strong>{selectedLocation?.location_name || selectedLocation?.name || "All locations"}</strong></span><ChevronDown aria-hidden="true" />
        </button>
        {openFilter === "location" && <div className="costs-margin-filter__menu costs-margin-filter__menu--locations">
          <button className={!location ? "is-selected" : ""} onClick={() => { onLocationChange(""); setOpenFilter(""); }} type="button">All locations{!location && <Check aria-hidden="true" />}</button>
          {locations.map((item) => <button className={String(item.id) === String(location) ? "is-selected" : ""} key={item.id} onClick={() => { onLocationChange(String(item.id)); setOpenFilter(""); }} type="button">{item.location_name || item.name}{String(item.id) === String(location) && <Check aria-hidden="true" />}</button>)}
        </div>}
      </div>
      <button className="costs-margin-filters__done" onClick={() => { setIsMobilePanelOpen(false); setOpenFilter(""); }} type="button">Done</button>
      </div>
    </section>
  );
}

function FinancialCard({ current, favorableDirection, kind = "currency", label, previous }) {
  const difference = current - previous;
  const percentageChange = previous === 0 ? null : (difference / Math.abs(previous)) * 100;
  const favorable = difference === 0 ? null : favorableDirection === "up" ? difference > 0 : difference < 0;
  const Icon = difference > 0 ? ArrowUp : difference < 0 ? ArrowDown : Minus;
  const value = kind === "percent" ? `${current.toFixed(1)}%` : formatCurrency(current);
  const previousValue = kind === "percent" ? `${previous.toFixed(1)}%` : formatCurrency(previous);
  const changeText = kind === "percent"
    ? `${Math.abs(difference).toFixed(1)} percentage points`
    : percentageChange === null
      ? `${formatCurrency(Math.abs(difference))} · —`
      : `${formatCurrency(Math.abs(difference))} · ${Math.abs(percentageChange).toFixed(1)}%`;
  const financialMetric = label === "Revenue" ? "revenue" : label === "Costs" ? "cost" : "margin";

  return (
    <article className="financial-summary-card" data-drill-current={value} data-drill-difference={kind === "percent" ? `${difference >= 0 ? "+" : ""}${difference.toFixed(1)} pts` : `${difference >= 0 ? "+" : "−"}${formatCurrency(Math.abs(difference))}`} data-drill-difference-percent={percentageChange === null ? "" : `${percentageChange >= 0 ? "+" : ""}${percentageChange.toFixed(1)}%`} data-drill-financial={financialMetric} data-drill-previous={previousValue} data-drill-title={label}>
      <span>{label}</span>
      <strong>{value}</strong>
      <div className={favorable === null ? "is-neutral" : favorable ? "is-favorable" : "is-unfavorable"}>
        <Icon aria-hidden="true" />
        <b>{changeText}</b>
      </div>
      <small>Comparison period: {previousValue}</small>
    </article>
  );
}

function EfficiencyCard({ count, countLabel, label, previousCount, previousValue, value }) {
  const difference = value !== null && previousValue !== null ? value - previousValue : null;
  const percentageChange = difference !== null && previousValue !== 0 ? (difference / Math.abs(previousValue)) * 100 : null;
  const favorable = difference === null || difference === 0 ? null : difference < 0;
  const Icon = difference === null || difference === 0 ? Minus : difference > 0 ? ArrowUp : ArrowDown;
  const denominator = label.includes("Booked") ? "scheduled" : label.includes("Completed") ? "toured" : "enrolled";

  return (
    <article className="cost-efficiency-card" data-drill-current={value === null ? "—" : formatCurrency(value)} data-drill-difference={difference === null ? "" : `${difference >= 0 ? "+" : "−"}${formatCurrency(Math.abs(difference))}`} data-drill-difference-percent={percentageChange === null ? "" : `${percentageChange >= 0 ? "+" : ""}${percentageChange.toFixed(1)}%`} data-drill-mode="event" data-drill-previous={previousValue === null ? "—" : formatCurrency(previousValue)} data-drill-status={denominator} data-drill-title={label}>
      <span>{label}</span>
      <strong>{value === null ? "—" : formatCurrency(value)}</strong>
      <small>{count.toLocaleString()} {countLabel}</small>
      <div className={favorable === null ? "is-neutral" : favorable ? "is-favorable" : "is-unfavorable"}>
        <Icon aria-hidden="true" />
        <b>{difference === null ? "No comparable value" : `${formatCurrency(Math.abs(difference))}${percentageChange === null ? "" : ` · ${Math.abs(percentageChange).toFixed(1)}%`}`}</b>
      </div>
      <small>Comparison: {previousValue === null ? "—" : formatCurrency(previousValue)} · {previousCount.toLocaleString()} {countLabel}</small>
    </article>
  );
}

function ExecutiveDecisionBrief({ brief }) {
  if (!brief?.keyFigures?.length) return null;
  return (
    <section className="executive-brief" aria-labelledby="executive-brief-title">
      <header><h2 id="executive-brief-title">Executive Summary</h2><p>Generated from the selected filters and comparison months.</p></header>
      <div className="executive-brief__figures">{brief.keyFigures.map((figure) => <div key={figure.label}><small>{figure.label}</small><strong>{figure.value}</strong></div>)}</div>
      {brief.sections?.length > 0 && <div className="executive-brief__sections">{brief.sections.map((section) => <section className={`executive-brief__section executive-brief__section--${section.key}`} key={section.key}><h3>{section.title}</h3><ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div>}
    </section>
  );
}

const trendSeries = [
  { key: "revenue", label: "Revenue", color: "#163968" },
  { key: "cost", label: "Costs", color: "#d09a16" },
  { key: "margin", label: "Contribution Margin", color: "#178454" },
];

function linePoints(rows, key, left, width, height, minimum, maximum) {
  const range = maximum - minimum || 1;
  return rows.map((row, index) => {
    const x = rows.length === 1 ? left + (width / 2) : left + ((index / (rows.length - 1)) * width);
    const y = height - (((Number(row[key]) - minimum) / range) * height);
    return `${x},${y}`;
  }).join(" ");
}

function compactCurrency(value) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1000000) return `${sign}$${(absolute / 1000000).toFixed(1).replace(".0", "")}M`;
  if (absolute >= 1000) return `${sign}$${(absolute / 1000).toFixed(0)}k`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function FinancialTrendChart({ onDrillThrough, rows }) {
  const [selectedValue, setSelectedValue] = useState(null);
  if (!rows.length) return <p className="financial-trend-empty">No financial data is available for this period.</p>;
  const width = 900;
  const height = 230;
  const plotLeft = 65;
  const plotRight = 835;
  const plotWidth = plotRight - plotLeft;
  const values = rows.flatMap((row) => trendSeries.map((series) => Number(row[series.key])));
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const zeroY = height - (((0 - minimum) / (maximum - minimum || 1)) * height);
  const rateValues = rows.filter((row) => row.marginRate !== null).map((row) => Number(row.marginRate));
  const rateMinimum = Math.min(0, ...rateValues);
  const rateMaximum = Math.max(0, ...rateValues);
  const rateRange = rateMaximum - rateMinimum || 1;
  const rateZeroY = height - (((0 - rateMinimum) / rateRange) * height);
  const barWidth = Math.min(54, plotWidth / Math.max(rows.length * 1.7, 1));
  const dollarTicks = Array.from({ length: 5 }, (_, index) => {
    const value = minimum + (((maximum - minimum) / 4) * index);
    return { value, y: height - ((index / 4) * height) };
  });

  function selectValue(value) {
    setSelectedValue(value);
  }

  function handleValueKeyDown(event, value) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectValue(value);
    }
  }

  function monthSelection(row) {
    return {
      month: formatMonth(row.month),
      items: [
        { label: "Revenue", value: formatCurrency(Number(row.revenue)) },
        { label: "Costs", value: formatCurrency(Number(row.cost)) },
        { label: "Contribution Margin", value: formatCurrency(Number(row.margin)) },
        { label: "Margin %", value: row.marginRate === null ? "—" : `${Number(row.marginRate).toFixed(1)}%` },
      ],
    };
  }

  return (
    <section className="financial-trend-card" aria-labelledby="financial-dollar-trend">
      <div className="financial-trend-heading">
        <h3 id="financial-dollar-trend">Monthly Financial Trend</h3>
        <button className="analytics-chart-drill-trigger" onClick={() => onDrillThrough({
          currentValue: formatCurrency(rows.reduce((total, row) => total + Number(row.margin || 0), 0)),
          drillParams: { drill_financial: "margin", drill_kpi: "Monthly Financial Trend" },
          title: "Monthly Financial Trend",
          viewContext: { Section: "Financial performance", "Chart / card": "Monthly Financial Trend" },
        })} type="button">Drill through</button>
        <div className="financial-trend-legend">{trendSeries.map((series) => <span key={series.key}><i style={{ background: series.color }} />{series.label}</span>)}<span><i className="financial-margin-rate-key" />Margin %</span></div>
      </div>
      <div className="financial-chart-scroll">
        <svg aria-label="Revenue, costs, contribution margin, and margin percentage by month" className="financial-line-chart" role="img" viewBox={`0 -12 ${width + 20} ${height + 52}`}>
          {dollarTicks.map((tick) => <g key={tick.y}><line className="financial-chart-gridline" x1={plotLeft} x2={plotRight} y1={tick.y} y2={tick.y} /><text className="financial-chart-axis-label" textAnchor="end" x={plotLeft - 9} y={tick.y + 4}>{compactCurrency(tick.value)}</text></g>)}
          <line className="financial-chart-zero" x1={plotLeft} x2={plotRight} y1={zeroY} y2={zeroY} />
          {rows.map((row, index) => {
            if (row.marginRate === null) return null;
            const x = rows.length === 1 ? plotLeft + (plotWidth / 2) : plotLeft + ((index / (rows.length - 1)) * plotWidth);
            const rate = Number(row.marginRate);
            const y = height - (((rate - rateMinimum) / rateRange) * height);
            const barX = Math.max(plotLeft, Math.min(plotRight - barWidth, x - (barWidth / 2)));
            const selection = monthSelection(row);
            return <g key={`rate-${row.month}`}><rect aria-label={`${selection.month}, show all financial values`} className="financial-margin-rate-bar financial-chart-interactive" height={Math.abs(rateZeroY - y)} onClick={() => selectValue(selection)} onKeyDown={(event) => handleValueKeyDown(event, selection)} role="button" tabIndex="0" width={barWidth} x={barX} y={Math.min(y, rateZeroY)}><title>{`${selection.month} · Contribution Margin %: ${rate.toFixed(1)}%`}</title></rect><text className="financial-margin-rate-value" textAnchor="middle" x={barX + (barWidth / 2)} y={rate >= 0 ? Math.max(12, y - 7) : Math.min(height - 4, y + 15)}>{rate.toFixed(1)}%</text></g>;
          })}
          {trendSeries.map((series) => <polyline fill="none" key={series.key} points={linePoints(rows, series.key, plotLeft, plotWidth, height, minimum, maximum)} stroke={series.color} strokeWidth="4" />)}
          {rows.map((row, index) => {
            const x = rows.length === 1 ? plotLeft + (plotWidth / 2) : plotLeft + ((index / (rows.length - 1)) * plotWidth);
            return <g key={row.month}>{trendSeries.map((series) => {
              const y = height - (((Number(row[series.key]) - minimum) / (maximum - minimum || 1)) * height);
              const selection = monthSelection(row);
              const pointValue = formatCurrency(Number(row[series.key]));
              return <circle aria-label={`${selection.month}, show all financial values`} className="financial-chart-interactive" cx={x} cy={y} fill={series.color} key={series.key} onClick={() => selectValue(selection)} onKeyDown={(event) => handleValueKeyDown(event, selection)} r="7" role="button" tabIndex="0"><title>{`${selection.month} · ${series.label}: ${pointValue}`}</title></circle>;
            })}<text className="financial-chart-label" textAnchor="middle" x={x} y={height + 27}>{formatMonth(row.month)}</text></g>;
          })}
          <text className="financial-chart-axis-label" textAnchor="start" x={plotRight + 9} y="8">{rateMaximum.toFixed(0)}%</text>
          <text className="financial-chart-axis-label" textAnchor="start" x={plotRight + 9} y={height}>{rateMinimum.toFixed(0)}%</text>
        </svg>
      </div>
      {selectedValue && <output className="financial-chart-selection" aria-live="polite"><strong>{selectedValue.month}</strong>{selectedValue.items.map((item) => <span key={item.label}>{item.label} <b>{item.value}</b></span>)}</output>}
    </section>
  );
}

const efficiencyTrendSeries = [
  { key: "costPerBooked", label: "Per Booked Tour", countKey: "booked", color: "#163968", labelOffset: -11 },
  { key: "costPerToured", label: "Per Completed Tour", countKey: "toured", color: "#d09a16", labelOffset: 3 },
  { key: "costPerEnrollment", label: "Per Enrollment", countKey: "enrolled", color: "#178454", labelOffset: 17 },
];

function efficiencyLineSegments(rows, key, left, width, height, maximum) {
  const segments = [];
  let current = [];
  rows.forEach((row, index) => {
    if (row[key] === null || row[key] === undefined) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = rows.length === 1 ? left + (width / 2) : left + ((index / (rows.length - 1)) * width);
    const y = height - ((Number(row[key]) / (maximum || 1)) * height);
    current.push(`${x},${y}`);
  });
  if (current.length) segments.push(current.join(" "));
  return segments;
}

function CostEfficiencyTrendChart({ onDrillThrough, rows }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  if (!rows.length) return null;
  const width = 900;
  const height = 210;
  const plotLeft = 65;
  const plotRight = 850;
  const plotWidth = plotRight - plotLeft;
  const values = rows.flatMap((row) => efficiencyTrendSeries.map((series) => row[series.key])).filter((value) => value !== null && value !== undefined).map(Number);
  const maximum = Math.max(0, ...values);
  const ticks = Array.from({ length: 5 }, (_, index) => ({ value: (maximum / 4) * index, y: height - ((index / 4) * height) }));

  function selectRow(row) {
    setSelectedMonth(row);
  }

  function handleKeyDown(event, row) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectRow(row);
    }
  }

  return (
    <section className="financial-trend-card cost-efficiency-trend" aria-labelledby="cost-efficiency-trend-title">
      <div className="financial-trend-heading"><h3 id="cost-efficiency-trend-title">Monthly Cost Efficiency Trend</h3><button className="analytics-chart-drill-trigger" onClick={() => onDrillThrough({
        currentValue: `${rows.length} month${rows.length === 1 ? "" : "s"}`,
        drillParams: { drill_kpi: "Monthly Cost Efficiency Trend", drill_mode: "event", drill_statuses: "scheduled,toured,enrolled" },
        title: "Monthly Cost Efficiency Trend",
        viewContext: { Section: "Cost Efficiency", "Chart / card": "Monthly Cost Efficiency Trend" },
      })} type="button">Drill through</button><div className="financial-trend-legend">{efficiencyTrendSeries.map((series) => <span key={series.key}><i style={{ background: series.color }} />{series.label}</span>)}</div></div>
      <div className="financial-chart-scroll">
        <svg aria-label="Monthly cost per booked tour, completed tour, and enrollment" className="financial-line-chart" role="img" viewBox={`0 -14 ${width + 20} ${height + 54}`}>
          {ticks.map((tick) => <g key={tick.y}><line className="financial-chart-gridline" x1={plotLeft} x2={plotRight} y1={tick.y} y2={tick.y} /><text className="financial-chart-axis-label" textAnchor="end" x={plotLeft - 9} y={tick.y + 4}>{compactCurrency(tick.value)}</text></g>)}
          {efficiencyTrendSeries.map((series) => efficiencyLineSegments(rows, series.key, plotLeft, plotWidth, height, maximum).map((points, index) => <polyline fill="none" key={`${series.key}-${index}`} points={points} stroke={series.color} strokeWidth="4" />))}
          {rows.map((row, rowIndex) => {
            const x = rows.length === 1 ? plotLeft + (plotWidth / 2) : plotLeft + ((rowIndex / (rows.length - 1)) * plotWidth);
            return <g key={row.month}>{efficiencyTrendSeries.map((series) => {
              if (row[series.key] === null || row[series.key] === undefined) return null;
              const value = Number(row[series.key]);
              const y = height - ((value / (maximum || 1)) * height);
              return <g key={series.key}><circle aria-label={`${formatMonth(row.month)}, show all cost efficiency values`} className="financial-chart-interactive" cx={x} cy={y} fill={series.color} onClick={() => selectRow(row)} onKeyDown={(event) => handleKeyDown(event, row)} r="7" role="button" tabIndex="0"><title>{`${formatMonth(row.month)} · ${series.label}: ${formatCurrency(value)}`}</title></circle><text className="cost-efficiency-point-value" textAnchor="middle" x={x} y={Math.max(10, y + series.labelOffset)}>{formatCurrency(value)}</text></g>;
            })}<text className="financial-chart-label" textAnchor="middle" x={x} y={height + 28}>{formatMonth(row.month)}</text></g>;
          })}
        </svg>
      </div>
      {selectedMonth && <output className="financial-chart-selection" aria-live="polite"><strong>{formatMonth(selectedMonth.month)}</strong>{efficiencyTrendSeries.map((series) => <span key={series.key}>{series.label} <b>{selectedMonth[series.key] === null ? "—" : formatCurrency(Number(selectedMonth[series.key]))}</b><small>{Number(selectedMonth[series.countKey] || 0).toLocaleString()} events</small></span>)}</output>}
    </section>
  );
}

function metricChange(current, comparison, favorableDirection = "up", kind = "currency") {
  if (comparison === null || comparison === undefined) return null;
  const difference = current - comparison;
  const favorable = difference === 0 ? null : favorableDirection === "up" ? difference > 0 : difference < 0;
  const sign = difference > 0 ? "+" : difference < 0 ? "−" : "";
  const absolute = Math.abs(difference);
  const formatted = kind === "percent"
    ? `${absolute.toFixed(1)} pp`
    : kind === "count"
      ? absolute.toLocaleString()
      : formatCurrency(absolute);
  return {
    label: `${sign}${formatted}`,
    tone: favorable === null ? "is-neutral" : favorable ? "is-favorable" : "is-unfavorable",
  };
}

function MetricDelta({ comparison, current, favorableDirection = "up", kind = "currency" }) {
  const change = metricChange(current, comparison, favorableDirection, kind);
  return change ? <small className={change.tone}>{change.label}</small> : null;
}

function LocationSortButton({ active, direction, field, label, onSort }) {
  return <button aria-label={`Sort by ${label}`} className={active ? "is-active" : ""} onClick={() => onSort(field)} type="button">{label}<span>{active ? direction === "asc" ? "↑" : "↓" : "↕"}</span></button>;
}

function LocationMetricDropdown({ label, onChange, options, value }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!dropdownRef.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return <div className="location-metric-dropdown" ref={dropdownRef}><button aria-expanded={isOpen} className="location-metric-dropdown__trigger" onClick={() => setIsOpen((current) => !current)} type="button"><span>{label}</span><strong>{selected.label}</strong><ChevronDown aria-hidden="true" /></button>{isOpen && <div className="location-metric-dropdown__menu">{options.map((option) => <button className={option.value === value ? "is-selected" : ""} key={option.value} onClick={() => { onChange(option.value); setIsOpen(false); }} type="button">{option.label}{option.value === value && <Check aria-hidden="true" />}</button>)}</div>}</div>;
}

function LocationMetricStack({ comparison, metrics, row }) {
  return <div className="location-metric-stack">{metrics.map((metric) => {
    const value = metric.getValue ? metric.getValue(row) : row[metric.key];
    const comparisonValue = comparison ? metric.getValue ? metric.getValue(comparison) : comparison[metric.key] : null;
    const unavailable = value === null || value === undefined;
    const displayValue = unavailable ? "—" : metric.kind === "currency" ? formatCurrency(Number(value)) : metric.kind === "percent" ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString();
    const status = metric.key === "booked" || metric.key === "costPerBooked" ? "scheduled" : metric.key === "toured" || metric.key === "costPerToured" ? "toured" : "enrolled";
    return <div className={metric.key === "totalActivity" ? "is-total" : ""} data-drill-current={displayValue} data-drill-dimension="location" data-drill-dimension-value={row.locationName} data-drill-mode="event" data-drill-previous={comparisonValue === null || comparisonValue === undefined ? "" : metric.kind === "currency" ? formatCurrency(Number(comparisonValue)) : Number(comparisonValue).toLocaleString()} data-drill-status={metric.key === "totalActivity" ? undefined : status} data-drill-statuses={metric.key === "totalActivity" ? "scheduled,toured,enrolled" : undefined} data-drill-title={`${metric.label} · ${row.locationName}`} key={metric.key}><span>{metric.label}</span><strong>{displayValue}</strong>{!unavailable && <MetricDelta comparison={comparisonValue === null || comparisonValue === undefined ? null : Number(comparisonValue)} current={Number(value)} favorableDirection={metric.favorableDirection} kind={metric.kind} />}</div>;
  })}</div>;
}

const locationVolumeOptions = [
  { value: "all", label: "Volume Overview" },
  { value: "booked", label: "Booked" },
  { value: "toured", label: "Toured" },
  { value: "enrolled", label: "Enrolled" },
];
const locationEfficiencyOptions = [
  { value: "all", label: "Overview" },
  { value: "costPerBooked", label: "Cost / Booked" },
  { value: "costPerToured", label: "Cost / Completed Tour" },
  { value: "costPerEnrollment", label: "Cost / Enrollment" },
];
const locationVolumeMetrics = [
  { key: "totalActivity", label: "Total Activity", kind: "count", getValue: (row) => Number(row.booked || 0) + Number(row.toured || 0) + Number(row.enrolled || 0) },
  { key: "booked", label: "Booked", kind: "count" },
  { key: "toured", label: "Toured", kind: "count" },
  { key: "enrolled", label: "Enrolled", kind: "count" },
];
const locationEfficiencyMetrics = [
  { key: "costPerBooked", label: "Per Booked", kind: "currency", favorableDirection: "down" },
  { key: "costPerToured", label: "Per Completed", kind: "currency", favorableDirection: "down" },
  { key: "costPerEnrollment", label: "Per Enrollment", kind: "currency", favorableDirection: "down" },
];

function selectedMetrics(metrics, selection) {
  if (selection === "all") return metrics;
  return metrics.filter((metric) => metric.key === selection);
}

function LocationPerformance({ comparisonRows, onDrillThrough, rows }) {
  const [sortKey, setSortKey] = useState("margin");
  const [sortDirection, setSortDirection] = useState("desc");
  const [volumeMetric, setVolumeMetric] = useState("all");
  const [efficiencyMetric, setEfficiencyMetric] = useState("all");
  const comparisonByLocation = new Map(comparisonRows.map((row) => [String(row.locationId), row]));
  const totalMargin = rows.reduce((sum, row) => sum + Number(row.margin || 0), 0);
  const comparisonTotalMargin = comparisonRows.reduce((sum, row) => sum + Number(row.margin || 0), 0);
  const preparedRows = rows.map((row) => {
    const comparison = comparisonByLocation.get(String(row.locationId));
    return {
      ...row,
      revenue: Number(row.revenue || 0),
      cost: Number(row.cost || 0),
      margin: Number(row.margin || 0),
      marginRate: row.marginRate === null ? null : Number(row.marginRate),
      booked: Number(row.booked || 0),
      toured: Number(row.toured || 0),
      enrolled: Number(row.enrolled || 0),
      conversionRate: row.conversionRate === null ? null : Number(row.conversionRate),
      costPerBooked: row.costPerBooked === null ? null : Number(row.costPerBooked),
      costPerToured: row.costPerToured === null ? null : Number(row.costPerToured),
      costPerEnrollment: row.costPerEnrollment === null ? null : Number(row.costPerEnrollment),
      share: totalMargin ? (Number(row.margin || 0) / totalMargin) * 100 : null,
      comparison,
      comparisonShare: comparison && comparisonTotalMargin ? (Number(comparison.margin || 0) / comparisonTotalMargin) * 100 : null,
    };
  });
  const sortedRows = [...preparedRows].sort((left, right) => {
    const leftValue = sortKey === "locationName" ? left.locationName : left[sortKey];
    const rightValue = sortKey === "locationName" ? right.locationName : right[sortKey];
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    const result = typeof leftValue === "string" ? leftValue.localeCompare(rightValue) : leftValue - rightValue;
    return sortDirection === "asc" ? result : -result;
  });
  function changeSort(nextKey) {
    if (sortKey === nextKey) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(nextKey);
      setSortDirection(nextKey === "locationName" ? "asc" : "desc");
    }
  }

  function changeVolumeMetric(nextMetric) {
    const matchingEfficiency = {
      all: "all",
      booked: "costPerBooked",
      toured: "costPerToured",
      enrolled: "costPerEnrollment",
    };
    setVolumeMetric(nextMetric);
    setEfficiencyMetric(matchingEfficiency[nextMetric]);
  }
  const financialDrillAttributes = (row, metric, label, current, previous) => ({
    "data-drill-current": current,
    "data-drill-dimension": "location",
    "data-drill-dimension-value": row.locationName,
    "data-drill-financial": metric,
    "data-drill-previous": previous,
    "data-drill-title": `${label} · ${row.locationName}`,
  });
  const conversionDrillAttributes = (row, previous) => ({
    "data-drill-current": row.conversionRate === null ? "—" : `${row.conversionRate.toFixed(1)}%`,
    "data-drill-denominator": "toured",
    "data-drill-dimension": "location",
    "data-drill-dimension-value": row.locationName,
    "data-drill-mode": "cohort",
    "data-drill-numerator": "enrolled",
    "data-drill-previous": previous?.conversionRate === null || !previous ? "" : `${Number(previous.conversionRate).toFixed(1)}%`,
    "data-drill-title": `Conversion Rate · ${row.locationName}`,
  });

  if (!rows.length) return <section className="location-performance-section"><div className="cost-efficiency-section__heading"><h3>Location Performance</h3><p>No location financial data is available for this period.</p></div></section>;

  return (
    <section className="location-performance-section" aria-labelledby="location-performance-title">
      <div className="cost-efficiency-section__heading"><div><h3 id="location-performance-title">Location Performance</h3><p>Financial contribution and enrollment efficiency by location.</p></div><button className="analytics-chart-drill-trigger" onClick={() => onDrillThrough({
        currentValue: rows.reduce((total, row) => total + Number(row.booked || 0) + Number(row.toured || 0) + Number(row.enrolled || 0), 0).toLocaleString(),
        drillParams: {
          drill_kpi: "Location Performance · Tour activity",
          drill_mode: "event",
          drill_statuses: "scheduled,toured,enrolled",
        },
        title: "Location Performance · Tour activity",
        viewContext: { Section: "Location Performance", "Chart / card": "Location performance table and cards" },
      })} type="button">Drill through</button></div>
      <div className="location-performance-table-wrap">
        <table aria-label="Location performance table" className="location-performance-table">
          <thead><tr><th><LocationSortButton active={sortKey === "locationName"} direction={sortDirection} field="locationName" label="Location" onSort={changeSort} /></th><th><LocationSortButton active={sortKey === "revenue"} direction={sortDirection} field="revenue" label="Revenue" onSort={changeSort} /></th><th><LocationSortButton active={sortKey === "cost"} direction={sortDirection} field="cost" label="Costs" onSort={changeSort} /></th><th><LocationSortButton active={sortKey === "margin"} direction={sortDirection} field="margin" label="Contribution Margin / Share" onSort={changeSort} /></th><th><LocationSortButton active={sortKey === "marginRate"} direction={sortDirection} field="marginRate" label="Margin %" onSort={changeSort} /></th><th><LocationSortButton active={sortKey === "conversionRate"} direction={sortDirection} field="conversionRate" label="Conversion Rate" onSort={changeSort} /></th><th><LocationMetricDropdown label="Volume View" onChange={changeVolumeMetric} options={locationVolumeOptions} value={volumeMetric} /></th><th><LocationMetricDropdown label="Efficiency View" onChange={setEfficiencyMetric} options={locationEfficiencyOptions} value={efficiencyMetric} /></th></tr></thead>
          <tbody>{sortedRows.map((row) => {
            const comparison = row.comparison;
            return <tr key={row.locationId}><th><strong>{row.locationName}</strong></th><td {...financialDrillAttributes(row, "revenue", "Revenue", formatCurrency(row.revenue), comparison ? formatCurrency(Number(comparison.revenue)) : "")}>{formatCurrency(row.revenue)}<MetricDelta comparison={comparison ? Number(comparison.revenue) : null} current={row.revenue} /></td><td {...financialDrillAttributes(row, "cost", "Costs", formatCurrency(row.cost), comparison ? formatCurrency(Number(comparison.cost)) : "")}>{formatCurrency(row.cost)}<MetricDelta comparison={comparison ? Number(comparison.cost) : null} current={row.cost} favorableDirection="down" /></td><td {...financialDrillAttributes(row, "margin", "Contribution Margin", formatCurrency(row.margin), comparison ? formatCurrency(Number(comparison.margin)) : "")}><strong>{formatCurrency(row.margin)}</strong><MetricDelta comparison={comparison ? Number(comparison.margin) : null} current={row.margin} /><span className="location-margin-share">Share: {row.share === null ? "—" : `${row.share.toFixed(1)}%`}{row.share !== null && <MetricDelta comparison={row.comparisonShare} current={row.share} kind="percent" />}</span></td><td {...financialDrillAttributes(row, "margin", "Margin %", row.marginRate === null ? "—" : `${row.marginRate.toFixed(1)}%`, comparison?.marginRate === null || !comparison ? "" : `${Number(comparison.marginRate).toFixed(1)}%`)}>{row.marginRate === null ? "—" : `${row.marginRate.toFixed(1)}%`}{row.marginRate !== null && <MetricDelta comparison={comparison?.marginRate === null || !comparison ? null : Number(comparison.marginRate)} current={row.marginRate} kind="percent" />}</td><td {...conversionDrillAttributes(row, comparison)}>{row.conversionRate === null ? "—" : `${row.conversionRate.toFixed(1)}%`}{row.conversionRate !== null && <MetricDelta comparison={comparison?.conversionRate === null || !comparison ? null : Number(comparison.conversionRate)} current={row.conversionRate} kind="percent" />}</td><td><LocationMetricStack comparison={comparison} metrics={selectedMetrics(locationVolumeMetrics, volumeMetric)} row={row} /></td><td><LocationMetricStack comparison={comparison} metrics={selectedMetrics(locationEfficiencyMetrics, efficiencyMetric)} row={row} /></td></tr>;
          })}</tbody>
        </table>
      </div>
      <div className="location-performance-mobile-controls"><LocationMetricDropdown label="Volume View" onChange={changeVolumeMetric} options={locationVolumeOptions} value={volumeMetric} /><LocationMetricDropdown label="Efficiency View" onChange={setEfficiencyMetric} options={locationEfficiencyOptions} value={efficiencyMetric} /></div>
      <div aria-label="Location performance cards" className="location-performance-cards">{sortedRows.map((row) => {
        const comparison = row.comparison;
        return <article key={row.locationId}><header><strong>{row.locationName}</strong></header><dl><div {...financialDrillAttributes(row, "revenue", "Revenue", formatCurrency(row.revenue), comparison ? formatCurrency(Number(comparison.revenue)) : "")}><dt>Revenue</dt><dd>{formatCurrency(row.revenue)}<MetricDelta comparison={comparison ? Number(comparison.revenue) : null} current={row.revenue} /></dd></div><div {...financialDrillAttributes(row, "cost", "Costs", formatCurrency(row.cost), comparison ? formatCurrency(Number(comparison.cost)) : "")}><dt>Costs</dt><dd>{formatCurrency(row.cost)}<MetricDelta comparison={comparison ? Number(comparison.cost) : null} current={row.cost} favorableDirection="down" /></dd></div><div {...financialDrillAttributes(row, "margin", "Contribution Margin", formatCurrency(row.margin), comparison ? formatCurrency(Number(comparison.margin)) : "")}><dt>Contribution Margin / Share</dt><dd>{formatCurrency(row.margin)}<MetricDelta comparison={comparison ? Number(comparison.margin) : null} current={row.margin} /><span className="location-margin-share">Share: {row.share === null ? "—" : `${row.share.toFixed(1)}%`}{row.share !== null && <MetricDelta comparison={row.comparisonShare} current={row.share} kind="percent" />}</span></dd></div><div {...financialDrillAttributes(row, "margin", "Margin %", row.marginRate === null ? "—" : `${row.marginRate.toFixed(1)}%`, comparison?.marginRate === null || !comparison ? "" : `${Number(comparison.marginRate).toFixed(1)}%`)}><dt>Margin %</dt><dd>{row.marginRate === null ? "—" : `${row.marginRate.toFixed(1)}%`}{row.marginRate !== null && <MetricDelta comparison={comparison?.marginRate === null || !comparison ? null : Number(comparison.marginRate)} current={row.marginRate} kind="percent" />}</dd></div><div {...conversionDrillAttributes(row, comparison)}><dt>Conversion Rate</dt><dd>{row.conversionRate === null ? "—" : `${row.conversionRate.toFixed(1)}%`}{row.conversionRate !== null && <MetricDelta comparison={comparison?.conversionRate === null || !comparison ? null : Number(comparison.conversionRate)} current={row.conversionRate} kind="percent" />}</dd></div><div><dt>Volume · {locationVolumeOptions.find((option) => option.value === volumeMetric)?.label}</dt><dd><LocationMetricStack comparison={comparison} metrics={selectedMetrics(locationVolumeMetrics, volumeMetric)} row={row} /></dd></div><div><dt>Cost Efficiency · {locationEfficiencyOptions.find((option) => option.value === efficiencyMetric)?.label}</dt><dd><LocationMetricStack comparison={comparison} metrics={selectedMetrics(locationEfficiencyMetrics, efficiencyMetric)} row={row} /></dd></div></dl></article>;
      })}</div>
    </section>
  );
}

function exportFinancialFilters(searchParams) {
  if (searchParams.get("analytics_export") !== "true") return {};
  try {
    return JSON.parse(searchParams.get("export_filters") || "{}");
  } catch {
    return {};
  }
}

function CostsMarginAnalytics() {
  const { setAnalyticsLoading } = useOutletContext();
  const [searchParams] = useSearchParams();
  const exportedFilters = useMemo(() => exportFinancialFilters(searchParams), [searchParams]);
  const latestCompletedMonth = useMemo(() => monthValue(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)), []);
  const exportedEndMonth = exportedFilters.date_to?.slice(0, 7);
  const initialEndMonth = exportedEndMonth && exportedEndMonth < latestCompletedMonth ? exportedEndMonth : latestCompletedMonth;
  const exportedStartMonth = exportedFilters.date_from?.slice(0, 7);
  const initialStartMonth = exportedStartMonth && exportedStartMonth <= initialEndMonth
    ? exportedStartMonth
    : shiftMonth(initialEndMonth, -5);
  const [startMonth, setStartMonth] = useState(initialStartMonth);
  const [endMonth, setEndMonth] = useState(initialEndMonth);
  const [compareIsCustom, setCompareIsCustom] = useState(false);
  const [customCompareStart, setCustomCompareStart] = useState(() => shiftMonth(latestCompletedMonth, -11));
  const [location, setLocation] = useState(exportedFilters.location || "");
  const [locations, setLocations] = useState([]);
  const [current, setCurrent] = useState({ revenue: 0, cost: 0, margin: 0 });
  const [previous, setPrevious] = useState({ revenue: 0, cost: 0, margin: 0 });
  const [currentVolumeCounts, setCurrentVolumeCounts] = useState({ scheduled: 0, toured: 0, enrolled: 0 });
  const [comparisonVolumeCounts, setComparisonVolumeCounts] = useState({ scheduled: 0, toured: 0, enrolled: 0 });
  const [trend, setTrend] = useState([]);
  const [efficiencyTrend, setEfficiencyTrend] = useState([]);
  const [locationPerformance, setLocationPerformance] = useState([]);
  const [comparisonLocationPerformance, setComparisonLocationPerformance] = useState([]);
  const [executiveBrief, setExecutiveBrief] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedMonthCount = monthRange(startMonth, endMonth).monthCount;
  const defaultCompareEnd = shiftMonth(startMonth, -1);
  const defaultCompareStart = shiftMonth(defaultCompareEnd, -(selectedMonthCount - 1));
  const compareStart = compareIsCustom ? customCompareStart : defaultCompareStart;
  const compareEnd = compareIsCustom ? shiftMonth(customCompareStart, selectedMonthCount - 1) : defaultCompareEnd;

  useEffect(() => {
    getLocations().then(setLocations).catch(() => setError("Unable to load locations."));
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const selectedRange = monthRange(startMonth, endMonth);
    const priorRange = monthRange(compareStart, compareEnd);
    const locationParams = location ? { location } : {};

    async function loadFinancials() {
      setIsLoading(true);
      setError("");
      try {
        const [selectedData, previousData] = await Promise.all([
          getCohortAnalytics({
            ...selectedRange,
            ...locationParams,
            comparison_date_from: priorRange.date_from,
            comparison_date_to: priorRange.date_to,
          }),
          getCohortAnalytics({ ...priorRange, ...locationParams }),
        ]);
        if (isCurrent) {
          setCurrent(selectedData.financialSummary);
          setPrevious(previousData.financialSummary);
          setCurrentVolumeCounts(selectedData.volumeCounts || {});
          setComparisonVolumeCounts(previousData.volumeCounts || {});
          setTrend(selectedData.financialTrend || []);
          setEfficiencyTrend(selectedData.costEfficiencyTrend || []);
          setLocationPerformance(selectedData.locationFinancialPerformance || []);
          setComparisonLocationPerformance(previousData.locationFinancialPerformance || []);
          setExecutiveBrief(selectedData.executiveBrief || null);
        }
      } catch {
        if (isCurrent) setError("Unable to load Costs & Margin analytics.");
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadFinancials();
    return () => { isCurrent = false; };
  }, [compareEnd, compareStart, endMonth, location, startMonth]);

  useEffect(() => {
    setAnalyticsLoading(isLoading);
    return () => setAnalyticsLoading(false);
  }, [isLoading, setAnalyticsLoading]);

  const currentMarginRate = current.revenue ? (current.margin / current.revenue) * 100 : 0;
  const previousMarginRate = previous.revenue ? (previous.margin / previous.revenue) * 100 : 0;
  const efficiencyMetrics = [
    { key: "scheduled", label: "Cost per Booked Tour", countLabel: "booked tours" },
    { key: "toured", label: "Cost per Completed Tour", countLabel: "completed tours" },
    { key: "enrolled", label: "Cost per Enrollment", countLabel: "enrollments" },
  ].map((metric) => {
    const count = Number(currentVolumeCounts[metric.key] || 0);
    const previousCount = Number(comparisonVolumeCounts[metric.key] || 0);
    return {
      ...metric,
      count,
      previousCount,
      value: count ? Number(current.cost) / count : null,
      previousValue: previousCount ? Number(previous.cost) / previousCount : null,
    };
  });
  const exportFilters = useMemo(() => ({
    ...monthRange(startMonth, endMonth),
    comparison_date_from: monthRange(compareStart, compareEnd).date_from,
    comparison_date_to: monthRange(compareStart, compareEnd).date_to,
    ...(location ? { location } : {}),
  }), [compareEnd, compareStart, endMonth, location, startMonth]);
  const { drillThrough, onClickCapture, openDrillThrough } = useAnalyticsDrillThrough({
    filterContext: {
      Location: locations.find((item) => String(item.id) === String(location))?.location_name || "All locations",
    },
    filters: exportFilters,
    page: "cost-margin",
    period: {
      selected: `${formatMonth(startMonth)} – ${formatMonth(endMonth)}`,
      previous: `${formatMonth(compareStart)} – ${formatMonth(compareEnd)}`,
    },
    rows: [...trend, ...locationPerformance],
  });

  function updateStart(value) {
    if (!value) return;
    setStartMonth(value);
    if (value > endMonth) setEndMonth(value);
  }

  function updateEnd(value) {
    if (!value) return;
    setEndMonth(value);
    if (value < startMonth) setStartMonth(value);
  }

  function updateCompareStart(value) {
    setCustomCompareStart(value);
    setCompareIsCustom(true);
  }

  function updateCompareEnd(value) {
    setCustomCompareStart(shiftMonth(value, -(selectedMonthCount - 1)));
    setCompareIsCustom(true);
  }

  return (
    <section className="analytics-page costs-margin-page" aria-label="Costs & Margin analytics" data-export-ready={!isLoading} onClickCapture={onClickCapture}>
      <AnalyticsExport filters={exportFilters} page="cost-margin" />
      <CostsMarginFilters compareEnd={compareEnd} compareIsCustom={compareIsCustom} compareStart={compareStart} endMonth={endMonth} latestCompletedMonth={latestCompletedMonth} location={location} locations={locations} onCompareEndChange={updateCompareEnd} onCompareReset={() => setCompareIsCustom(false)} onCompareStartChange={updateCompareStart} onEndChange={updateEnd} onLocationChange={setLocation} onStartChange={updateStart} selectedMonthCount={selectedMonthCount} startMonth={startMonth} />

      {error && <p className="analytics-state analytics-state--error">{error}</p>}
      <ExecutiveDecisionBrief brief={executiveBrief} />

      <section aria-label="Costs and margin analysis" className="analytics-workspace costs-margin-workspace">
        <header className="costs-margin-period">
          <div><strong>{formatMonth(startMonth)} – {formatMonth(endMonth)}</strong><span>vs {formatMonth(compareStart)} – {formatMonth(compareEnd)}</span></div>
          <p>Financial data is reported for completed months.</p>
        </header>
        <div className="financial-summary-grid" aria-label="Financial summary">
          <FinancialCard current={Number(current.revenue)} favorableDirection="up" label="Revenue" previous={Number(previous.revenue)} />
          <FinancialCard current={Number(current.cost)} favorableDirection="down" label="Costs" previous={Number(previous.cost)} />
          <FinancialCard current={Number(current.margin)} favorableDirection="up" label="Contribution Margin" previous={Number(previous.margin)} />
          <FinancialCard current={currentMarginRate} favorableDirection="up" kind="percent" label="Contribution Margin %" previous={previousMarginRate} />
        </div>
        <FinancialTrendChart onDrillThrough={openDrillThrough} rows={trend} />
        <section className="cost-efficiency-section" aria-labelledby="cost-efficiency-title">
          <div className="cost-efficiency-section__heading"><div><h3 id="cost-efficiency-title">Cost Efficiency</h3><p>Recorded costs divided by funnel activity during each completed-month period.</p></div></div>
          <div className="cost-efficiency-grid">
            {efficiencyMetrics.map((metric) => <EfficiencyCard count={metric.count} countLabel={metric.countLabel} key={metric.key} label={metric.label} previousCount={metric.previousCount} previousValue={metric.previousValue} value={metric.value} />)}
          </div>
          <CostEfficiencyTrendChart onDrillThrough={openDrillThrough} rows={efficiencyTrend} />
        </section>
        <LocationPerformance comparisonRows={comparisonLocationPerformance} onDrillThrough={openDrillThrough} rows={locationPerformance} />
      </section>
      {drillThrough}
    </section>
  );
}

export default CostsMarginAnalytics;
