/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, X } from "lucide-react";

import { exportAnalyticsDrillThrough, exportAnalyticsLayoutPdf, getAnalyticsDrillThrough } from "../../features/analytics/analyticsApi";
import useAuth from "../../features/auth/useAuth";

const drillSelector = [
  ".analytics-overview-card",
  ".analytics-overview-performance-card",
  ".analytics-flow-node",
  ".analytics-insight",
  ".analytics-ranking__item",
  ".analytics-preview-card__winner[data-drill-title]",
  ".analytics-preview-card__ranking > div[data-drill-title]",
  ".analytics-preview-card__financial-rows > div[data-drill-title]",
  ".analytics-temporal-rankings__grid li",
  ".analytics-progress-time__heat-cell",
  ".analytics-progress-time__average",
  ".analytics-location-health tbody td[data-drill-title]",
  ".analytics-location-health tbody .analytics-health__current[data-drill-title]",
  ".analytics-location-metric-list article",
  ".analytics-location-bars article",
  ".analytics-location-performance__overall",
  ".financial-summary-card",
  ".cost-efficiency-card",
  ".location-performance-table td[data-drill-title]",
  ".location-performance-cards dl > div[data-drill-title]",
  ".location-metric-stack > div[data-drill-title]",
].join(",");

function readableText(element) {
  const aria = element.getAttribute("aria-label");
  if (aria) return aria;
  return element.innerText?.replace(/\s+/g, " ").trim() || "Analytics detail";
}

function contextLabel(element) {
  if (!element) return "";
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = document.getElementById(labelledBy)?.textContent?.replace(/\s+/g, " ").trim();
    if (label) return label;
  }
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  return element.querySelector(":scope > header h2, :scope > header h3, :scope > h2, :scope > h3")
    ?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function inferDrillContext(target) {
  const section = target.closest([
    ".analytics-overview-section",
    ".analytics-workspace",
    ".cost-efficiency-section",
    ".location-performance-section",
  ].join(","));
  const visualization = target.closest([
    ".analytics-preview-card",
    ".analytics-flow",
    ".analytics-insights",
    ".analytics-overview-grid",
    ".analytics-overview-performance-grid",
    ".analytics-rate-stack",
    ".analytics-ranking",
    ".analytics-progress-time",
    ".analytics-temporal-rankings__grid > article",
    ".analytics-location-comparison__panel",
    ".analytics-location-health",
    ".financial-summary-grid",
    ".cost-efficiency-grid",
    ".financial-trend-card",
    ".location-performance-table",
    ".location-performance-cards",
  ].join(","));
  const sectionName = target.dataset.drillSection || contextLabel(section);
  let visualizationName = target.dataset.drillVisualization || contextLabel(visualization);
  if (!visualizationName && visualization?.classList.contains("analytics-preview-card")) {
    visualizationName = visualization.querySelector("h3")?.textContent?.replace(/\s+/g, " ").trim() || "";
  }
  if (visualizationName === sectionName) visualizationName = "";
  return {
    ...(sectionName ? { Section: sectionName } : {}),
    ...(visualizationName ? { "Chart / card": visualizationName } : {}),
    ...(target.dataset.drillScope ? { Scope: target.dataset.drillScope === "all" ? "All time" : "Selected period" } : {}),
  };
}

const drillColumns = [
  { key: "contributingKpi", label: "Contributing KPI" },
  { key: "contributionDate", label: "Contribution date" },
  { key: "elapsedDays", label: "Elapsed days", optional: true },
  { key: "elapsedBucket", label: "Days bucket", optional: true },
  { key: "familyName", label: "Family name" },
  { key: "scheduledDateTime", label: "Scheduled tour" },
  { key: "location", label: "Location" },
  { key: "currentStatus", label: "Current status" },
  { key: "assignedStaff", label: "Assigned staff" },
  { key: "leadSource", label: "Lead source" },
  { key: "studentName", label: "Student name" },
  { key: "childGrade", label: "Child grade" },
  { key: "emailPhone", label: "Email / phone" },
];

function formatDrillValue(key, value) {
  if (!value) return "—";
  if (key === "amount") {
    return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" });
  }
  if (key === "reportingMonth") {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long" });
  }
  if (key === "contributionDate") {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  if (key === "scheduledDateTime") {
    return new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return String(value);
}

export function useAnalyticsDrillThrough({ filterContext = {}, filters, page, period, rows = [] }) {
  const [detail, setDetail] = useState(null);

  async function openDrillThrough({
    contributionKind = "count",
    currentValue,
    difference = "",
    differencePercent = "",
    drillParams = {},
    hasComparison = false,
    previousValue = "",
    title,
    viewContext = {},
  }) {
    setDetail({
      title,
      value: currentValue,
      currentValue,
      difference,
      differencePercent,
      drillParams,
      contributionKind,
      previousValue,
      hasComparison,
      viewContext,
      rows,
      isLoading: true,
    });
    try {
      const result = await getAnalyticsDrillThrough({ ...filters, ...drillParams });
      setDetail((current) => current ? {
        ...current,
        count: result.count,
        isLoading: false,
        isTruncated: result.isTruncated,
        rows: result.rows,
      } : current);
    } catch {
      setDetail((current) => current ? { ...current, isLoading: false, rows: [] } : current);
    }
  }

  async function onClickCapture(event) {
    if (event.target.closest("button, a, input, select, summary, details")) return;
    const target = event.target.closest(drillSelector);
    if (!target) return;
    const text = readableText(target);
    const parts = text.split(/(?<=\D)(?=\$?[\d—-])/);
    const title = target.dataset.drillTitle || parts[0]?.trim() || "Analytics detail";
    const currentValue = target.dataset.drillCurrent || parts.slice(1).join(" ").trim() || text;
    const previousValue = target.dataset.drillPrevious || "";
    const difference = target.dataset.drillDifference || "";
    const differencePercent = target.dataset.drillDifferencePercent || "";
    const drillParams = {
      ...(target.dataset.drillDenominator ? { drill_denominator: target.dataset.drillDenominator } : {}),
      ...(target.dataset.drillDimension ? { drill_dimension: target.dataset.drillDimension } : {}),
      ...(target.dataset.drillDimensionValue ? { drill_dimension_value: target.dataset.drillDimensionValue } : {}),
      ...(target.dataset.drillFinancial ? { drill_financial: target.dataset.drillFinancial } : {}),
      ...(target.dataset.drillElapsedMax ? { drill_elapsed_max: target.dataset.drillElapsedMax } : {}),
      ...(target.dataset.drillElapsedMin ? { drill_elapsed_min: target.dataset.drillElapsedMin } : {}),
      drill_kpi: title,
      ...(target.dataset.drillMode ? { drill_mode: target.dataset.drillMode } : {}),
      ...(target.dataset.drillNumerator ? { drill_numerator: target.dataset.drillNumerator } : {}),
      ...(target.dataset.drillPending ? { drill_pending: target.dataset.drillPending } : {}),
      ...(target.dataset.drillScope ? { drill_scope: target.dataset.drillScope } : {}),
      ...(target.dataset.drillStatus ? { drill_status: target.dataset.drillStatus } : {}),
      ...(target.dataset.drillStatuses ? { drill_statuses: target.dataset.drillStatuses } : {}),
      ...(target.dataset.drillTemporalDimension ? { drill_temporal_dimension: target.dataset.drillTemporalDimension } : {}),
      ...(target.dataset.drillTemporalValue ? { drill_temporal_value: target.dataset.drillTemporalValue } : {}),
      ...(target.dataset.drillTransition ? { drill_transition: target.dataset.drillTransition } : {}),
      ...(target.dataset.drillTransitions ? { drill_transitions: target.dataset.drillTransitions } : {}),
    };
    const contributionKind = target.dataset.drillDenominator
      ? title.toLowerCase().includes("avg.") || title.toLowerCase().includes("average")
        ? "average"
        : "rate"
      : "count";
    await openDrillThrough({
      title,
      currentValue,
      difference,
      differencePercent,
      drillParams,
      contributionKind,
      previousValue,
      hasComparison: Boolean(previousValue),
      viewContext: inferDrillContext(target),
    });
  }

  return {
    openDrillThrough,
    onClickCapture,
    drillThrough: detail ? (
      <DrillThroughDrawer
        detail={detail}
        filterContext={filterContext}
        filters={filters}
        onClose={() => setDetail(null)}
        page={page}
        period={period}
        rows={detail.rows || rows}
      />
    ) : null,
  };
}

function DrillThroughDrawer({ detail, filterContext, filters, onClose, page, period, rows }) {
  const closeRef = useRef(null);
  const isAllTime = detail.viewContext?.Scope === "All time";
  const currentPeriod = isAllTime ? "All Time" : typeof period === "object" ? period?.selected : period;
  const previousPeriod = typeof period === "object" ? period?.previous : "";
  const pageLabel = String(page || "Analytics").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const hasTourRows = rows.some((row) => row.tourId);
  const visibleColumns = hasTourRows
    ? drillColumns.filter((column) => !column.optional || rows.some((row) => row[column.key]))
    : Object.keys(rows[0] || {}).filter((key) => !key.endsWith("Id")).slice(0, 6).map((key) => ({
      key,
      label: key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    }));

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="analytics-drawer-layer" role="presentation">
      <button aria-label="Close drill-through" className="analytics-drawer-layer__backdrop" onClick={onClose} type="button" />
      <aside aria-label={`${detail.title} drill-through`} aria-modal="true" className="analytics-drill-drawer" role="dialog">
        <header>
          <button aria-label="Back" className="analytics-drill-drawer__back" onClick={onClose} type="button"><ArrowLeft /></button>
          <div><small>Drill-through</small><h2>{detail.title}</h2></div>
          <button aria-label="Close" onClick={onClose} ref={closeRef} type="button"><X /></button>
        </header>
        <div className="analytics-drill-drawer__body">
          <section className="analytics-drill-drawer__value">
            <span>{detail.title}</span>
            <dl>
              <div><dt>Current value</dt><dd>{detail.currentValue || detail.value || "—"}</dd></div>
              {detail.hasComparison && !isAllTime && <div><dt>Previous value</dt><dd>{detail.previousValue}</dd></div>}
              {detail.hasComparison && !isAllTime && detail.difference && <div><dt>Difference</dt><dd>{detail.difference}</dd></div>}
              {detail.hasComparison && !isAllTime && detail.differencePercent && <div><dt>Difference %</dt><dd>{detail.differencePercent}</dd></div>}
            </dl>
          </section>
          <section><h3>Context</h3><dl><div><dt>Page</dt><dd>{pageLabel}</dd></div>{Object.entries(detail.viewContext || {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}<div><dt>Current period</dt><dd>{currentPeriod || "Selected period"}</dd></div>{detail.hasComparison && !isAllTime && previousPeriod && <div><dt>Previous period</dt><dd>{previousPeriod}</dd></div>}{Object.entries(filterContext).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></section>
          <section><h3>Contributing data{detail.count !== undefined ? ` · ${detail.count.toLocaleString()} records` : ""}</h3>{detail.contributionKind === "average" && detail.count !== undefined && <p className="analytics-drill-drawer__explanation"><strong>Why this count differs:</strong> {detail.title} is calculated from these {detail.count.toLocaleString()} tours scheduled in the selected period that later reached enrollment. The Enrolled KPI instead counts enrollment events that occurred during the selected period.</p>}{detail.contributionKind === "rate" && detail.count !== undefined && <p className="analytics-drill-drawer__explanation"><strong>Why this count differs:</strong> {detail.title} is a percentage, while these {detail.count.toLocaleString()} rows are the eligible denominator population used to calculate that rate.</p>}{detail.isLoading ? <p>Loading authorized records…</p> : rows.length ? <><div className="analytics-drill-drawer__table"><table><thead><tr>{visibleColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.slice(0, 100).map((row, index) => <tr key={row.tourId || index}>{visibleColumns.map((column) => <td key={column.key}>{typeof row[column.key] === "object" ? "—" : formatDrillValue(column.key, row[column.key])}</td>)}</tr>)}</tbody></table></div>{detail.isTruncated && <p>Showing the first 100 records. Export to retrieve the complete filtered dataset.</p>}</> : <p>The selected value is calculated from the filtered analytics dataset. No lower-level rows are available for this aggregate.</p>}</section>
          <button className="analytics-drill-drawer__export" onClick={() => exportAnalyticsDrillThrough({
            ...filters,
            ...detail.drillParams,
            drill_current_value: detail.currentValue || detail.value || "—",
            drill_previous_value: detail.hasComparison && !isAllTime ? detail.previousValue : "",
            drill_difference: detail.hasComparison && !isAllTime ? detail.difference : "",
            drill_difference_percent: detail.hasComparison && !isAllTime ? detail.differencePercent : "",
            drill_current_period: currentPeriod || "Selected period",
            drill_previous_period: detail.hasComparison && !isAllTime ? previousPeriod : "",
            drill_location_label: filterContext.Location || "",
            drill_lead_source_label: filterContext["Lead source"] || filterContext["Lead Source"] || "",
            drill_staff_label: filterContext.Staff || "",
            drill_page: pageLabel,
            drill_section: detail.viewContext?.Section || "",
            drill_visualization: detail.viewContext?.["Chart / card"] || "",
          })} type="button"><FileSpreadsheet />Export these results</button>
        </div>
      </aside>
    </div>
  );
}

const choices = {
  coverage: [
    { value: "current", label: "Current analytics page", detail: "Export only the page you are viewing." },
    { value: "all", label: "All analytics pages", detail: "Export every page your role can access." },
  ],
  viewScope: [
    { value: "current", label: "Current view", detail: "Keep the metric modes and selections currently shown." },
    { value: "all", label: "All available views", detail: "Include every achievable metric mode on the selected page or pages." },
  ],
  dataScope: [
    { value: "current", label: "Current filtered data", detail: "Use the active period, comparison, and entity filters." },
    { value: "all_authorized", label: "All authorized data", detail: "Include all entities you are permitted to access." },
  ],
};

export function AnalyticsExport({ filters, page }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportStatus, setExportStatus] = useState(null);
  const [options, setOptions] = useState({ coverage: "current", viewScope: "current", dataScope: "current" });
  const keys = ["coverage", "viewScope", "dataScope"];
  const titles = ["What should be included?", "Which page views?", "How much data?"];
  const currentKey = keys[step];

  function close() {
    setIsOpen(false);
    setStep(0);
    setExportError("");
  }

  async function download() {
    setIsExporting(true);
    setExportError("");
    setExportStatus({ message: "Preparing analytics export…", status: "loading" });
    try {
      close();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = await exportAnalyticsLayoutPdf({
        currentElement: document.querySelector(".analytics-page"),
        filters,
        onProgress: ({ current, label, total }) => setExportStatus({
          detail: `${current} of ${total}`,
          message: `Preparing ${label}`,
          status: "loading",
        }),
        options,
        page,
        role: user?.role,
      });
      setExportStatus({
        detail: `${result.total} view${result.total === 1 ? "" : "s"} exported`,
        message: "PDF export complete. Download started.",
        status: "success",
      });
      window.setTimeout(() => setExportStatus((current) => current?.status === "success" ? null : current), 5000);
    } catch {
      setIsOpen(true);
      setStep(2);
      setExportError("The export could not be generated. Please try again.");
      setExportStatus({
        message: "PDF export failed. Please try again.",
        status: "error",
      });
    } finally {
      setIsExporting(false);
    }
  }

  const titleActions = document.getElementById("analytics-title-actions");
  const trigger = (
    <button aria-label="Export analytics" className="analytics-export-trigger" onClick={() => setIsOpen(true)} type="button"><Download /><span>Export</span></button>
  );

  return (
    <>
      {titleActions ? createPortal(trigger, titleActions) : trigger}
      {exportStatus && <aside aria-live="polite" className={`analytics-export-status analytics-export-status--${exportStatus.status}`} role={exportStatus.status === "error" ? "alert" : "status"}>
        {exportStatus.status === "loading" ? <LoaderCircle aria-hidden="true" className="analytics-export-status__spinner" /> : exportStatus.status === "success" ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
        <span><strong>{exportStatus.message}</strong>{exportStatus.detail && <small>{exportStatus.detail}</small>}</span>
        {exportStatus.status !== "loading" && <button aria-label="Dismiss export status" onClick={() => setExportStatus(null)} type="button"><X aria-hidden="true" /></button>}
      </aside>}
      {isOpen && <div className="analytics-export-layer">
        <button aria-label="Close export" className="analytics-export-layer__backdrop" onClick={close} type="button" />
        <section aria-modal="true" className="analytics-export-dialog" role="dialog">
          <header><div><small>Step {step + 1} of 3</small><h2>{titles[step]}</h2></div><button aria-label="Close" onClick={close} type="button"><X /></button></header>
          <div className="analytics-export-dialog__progress">{keys.map((key, index) => <i className={index <= step ? "is-active" : ""} key={key} />)}</div>
          {exportError && <p className="analytics-export-dialog__error" role="alert">{exportError}</p>}
          <div className="analytics-export-dialog__choices">{choices[currentKey].map((choice) => {
            const Icon = choice.icon;
            return <button className={options[currentKey] === choice.value ? "is-selected" : ""} key={choice.value} onClick={() => setOptions((current) => ({ ...current, [currentKey]: choice.value }))} type="button">{Icon && <Icon />}<span><strong>{choice.label}</strong><small>{choice.detail}</small></span></button>;
          })}</div>
          <footer><button disabled={step === 0} onClick={() => setStep((value) => value - 1)} type="button">Back</button>{step < 2 ? <button className="is-primary" onClick={() => setStep((value) => value + 1)} type="button">Continue</button> : <button className="is-primary" disabled={isExporting} onClick={download} type="button"><Download />{isExporting ? "Preparing…" : "Export PDF"}</button>}</footer>
        </section>
      </div>}
    </>
  );
}
