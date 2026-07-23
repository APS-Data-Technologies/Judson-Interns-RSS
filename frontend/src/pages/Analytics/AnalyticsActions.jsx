/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Download, FileSpreadsheet, FileText, X } from "lucide-react";

import { exportAnalytics, exportVisualAnalyticsPdf, getAnalyticsDrillThrough } from "../../features/analytics/analyticsApi";

const drillSelector = [
  ".analytics-overview-card",
  ".analytics-overview-performance-card",
  ".analytics-flow__stage",
  ".analytics-ranking__item",
  ".analytics-temporal-rankings__grid li",
  ".analytics-location-health tbody .analytics-health__comparison",
  ".analytics-location-health tbody td > .analytics-health__current",
  ".financial-summary-card",
  ".cost-efficiency-card",
  ".financial-trend-chart circle",
  ".cost-efficiency-trend-chart circle",
  ".location-performance-table td",
  ".location-performance-cards dl > div",
].join(",");

function readableText(element) {
  const aria = element.getAttribute("aria-label");
  if (aria) return aria;
  return element.innerText?.replace(/\s+/g, " ").trim() || "Analytics detail";
}

export function useAnalyticsDrillThrough({ filters, page, period, rows = [] }) {
  const [detail, setDetail] = useState(null);

  async function onClickCapture(event) {
    if (event.target.closest("button, a, input, select, summary, details")) return;
    const target = event.target.closest(drillSelector);
    if (!target) return;
    const text = readableText(target);
    const parts = text.split(/(?<=\D)(?=\$?[\d—-])/);
    setDetail({
      title: parts[0]?.trim() || "Analytics detail",
      value: parts.slice(1).join(" ").trim() || text,
      rows,
      isLoading: page !== "cost-margin",
    });
    if (page !== "cost-margin") {
      try {
        const result = await getAnalyticsDrillThrough(filters);
        setDetail((current) => current ? {
          ...current,
          count: result.count,
          isLoading: false,
          isTruncated: result.isTruncated,
          rows: result.rows,
        } : current);
      } catch {
        setDetail((current) => current ? { ...current, isLoading: false } : current);
      }
    }
  }

  return {
    onClickCapture,
    drillThrough: detail ? (
      <DrillThroughDrawer
        detail={detail}
        filters={filters}
        onClose={() => setDetail(null)}
        page={page}
        period={period}
        rows={detail.rows || rows}
      />
    ) : null,
  };
}

function DrillThroughDrawer({ detail, filters, onClose, page, period, rows }) {
  const closeRef = useRef(null);

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
          <section className="analytics-drill-drawer__value"><span>Selected value</span><strong>{detail.value || "—"}</strong></section>
          <section><h3>Context</h3><dl><div><dt>Page</dt><dd>{page}</dd></div><div><dt>Period</dt><dd>{period || "Selected period"}</dd></div>{Object.entries(filters || {}).filter(([, value]) => value && (!Array.isArray(value) || value.length)).slice(0, 6).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>)}</dl></section>
          <section><h3>Contributing data{detail.count !== undefined ? ` · ${detail.count.toLocaleString()} records` : ""}</h3>{detail.isLoading ? <p>Loading authorized records…</p> : rows.length ? <><div className="analytics-drill-drawer__table"><table><thead><tr>{Object.keys(rows[0]).slice(0, 6).map((key) => <th key={key}>{key.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.slice(0, 100).map((row, index) => <tr key={index}>{Object.keys(rows[0]).slice(0, 6).map((key) => <td key={key}>{typeof row[key] === "object" ? "—" : String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></div>{detail.isTruncated && <p>Showing the first 100 records. Export to retrieve the complete filtered dataset.</p>}</> : <p>The selected value is calculated from the filtered analytics dataset. No lower-level rows are available for this aggregate.</p>}</section>
          <button className="analytics-drill-drawer__export" onClick={() => exportAnalytics({ coverage: "current", dataScope: "current", filters, format: "xlsx", page })} type="button"><FileSpreadsheet />Export these results</button>
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
  format: [
    { value: "pdf", label: "PDF report", detail: "Decision-ready report with summaries and compact tables.", icon: FileText },
    { value: "xlsx", label: "Excel workbook", detail: "Underlying tables in analysis-ready worksheets.", icon: FileSpreadsheet },
  ],
};

export function AnalyticsExport({ filters, page }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [options, setOptions] = useState({ coverage: "current", viewScope: "current", dataScope: "current", format: "pdf" });
  const keys = ["coverage", "viewScope", "dataScope", "format"];
  const titles = ["What should be included?", "Which page views?", "How much data?", "Choose a format"];
  const currentKey = keys[step];

  function close() {
    setIsOpen(false);
    setStep(0);
    setExportError("");
  }

  async function download() {
    setIsExporting(true);
    setExportError("");
    try {
      if (options.format === "pdf") {
        close();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const analyticsPage = document.querySelector(".analytics-page");
        if (analyticsPage) {
          await exportVisualAnalyticsPdf(analyticsPage, `${page}-analytics.pdf`);
        }
      } else {
        await exportAnalytics({ ...options, filters, page });
        close();
      }
    } catch {
      setIsOpen(true);
      setStep(3);
      setExportError("The export could not be generated. Please try again.");
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
      {isOpen && <div className="analytics-export-layer">
        <button aria-label="Close export" className="analytics-export-layer__backdrop" onClick={close} type="button" />
        <section aria-modal="true" className="analytics-export-dialog" role="dialog">
          <header><div><small>Step {step + 1} of 4</small><h2>{titles[step]}</h2></div><button aria-label="Close" onClick={close} type="button"><X /></button></header>
          <div className="analytics-export-dialog__progress">{keys.map((key, index) => <i className={index <= step ? "is-active" : ""} key={key} />)}</div>
          {exportError && <p className="analytics-export-dialog__error" role="alert">{exportError}</p>}
          <div className="analytics-export-dialog__choices">{choices[currentKey].map((choice) => {
            const Icon = choice.icon;
            return <button className={options[currentKey] === choice.value ? "is-selected" : ""} key={choice.value} onClick={() => setOptions((current) => ({ ...current, [currentKey]: choice.value }))} type="button">{Icon && <Icon />}<span><strong>{choice.label}</strong><small>{choice.detail}</small></span></button>;
          })}</div>
          <footer><button disabled={step === 0} onClick={() => setStep((value) => value - 1)} type="button">Back</button>{step < 3 ? <button className="is-primary" onClick={() => setStep((value) => value + 1)} type="button">Continue</button> : <button className="is-primary" disabled={isExporting} onClick={download} type="button"><Download />{isExporting ? "Preparing…" : "Export"}</button>}</footer>
        </section>
      </div>}
    </>
  );
}
