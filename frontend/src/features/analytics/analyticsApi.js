import api from "../../services/api/api";

const analyticsPageLabels = {
  overview: "Overview",
  volume: "Volume & Trend",
  cohort: "Conversion & Cohort",
  locations: "Location",
  leadSources: "Lead Source",
  staff: "Staff",
  "cost-margin": "Costs & Margin",
};
const analyticsPageRoutes = {
  overview: "/analytics/overview",
  volume: "/analytics/volume",
  cohort: "/analytics/cohort",
  locations: "/analytics/locations",
  leadSources: "/analytics/lead-sources",
  staff: "/analytics/staff",
  "cost-margin": "/analytics/cost-margin",
};

function safeFilenamePart(value) {
  return String(value || "")
    .split("")
    .map((character) => character.charCodeAt(0) < 32 ? "-" : character)
    .join("")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[ .-]+|[ .-]+$/g, "");
}

function responseFilename(disposition) {
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ""));
    } catch {
      return encoded;
    }
  }
  return disposition.match(/filename="([^"]+)"/i)?.[1]
    || disposition.match(/filename=([^;]+)/i)?.[1]?.trim().replace(/^"|"$/g, "");
}

function analyticsPdfFallbackFilename(payload) {
  const coverage = payload.coverage === "all"
    ? "All Pages"
    : analyticsPageLabels[payload.page] || "Analytics";
  const viewScope = payload.viewScope === "all" ? "All Views" : "Current View";
  const dataScope = payload.dataScope === "all_authorized"
    ? "All Authorized Data"
    : "Current Filtered Data";
  return [
    "RSS Analytics",
    coverage,
    viewScope,
    dataScope,
  ].map(safeFilenamePart).filter(Boolean).join(" - ") + ".pdf";
}

export async function getCohortAnalytics(params = {}) {
  const response = await api.get("/analytics/cohort/", { params });
  return response.data;
}

export async function exportAnalytics(payload) {
  const response = await api.post("/analytics/export/", payload, { responseType: "blob" });
  const disposition = response.headers["content-disposition"] || "";
  const filename = responseFilename(disposition)
    || (payload.format === "pdf" ? analyticsPdfFallbackFilename(payload) : "analytics-data.xlsx");
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function waitForAnalyticsPage(frame, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const page = frame.contentDocument?.querySelector('.analytics-page[data-export-ready="true"]');
      if (page) {
        resolve(page);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Timed out while preparing an analytics page for export."));
        return;
      }
      window.setTimeout(check, 150);
    };
    check();
  });
}

function copyApplicationStylesToFrame(frame) {
  const frameDocument = frame.contentDocument;
  if (!frameDocument?.head) return;

  const cssText = Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules || [], (rule) => rule.cssText);
      } catch {
        return [];
      }
    })
    .join("\n");

  if (!cssText) return;
  const style = frameDocument.createElement("style");
  style.dataset.analyticsExportStyles = "true";
  style.textContent = cssText;
  frameDocument.head.appendChild(style);
}

async function waitForFrameAssets(frame) {
  const frameDocument = frame.contentDocument;
  await frameDocument?.fonts?.ready;
  const pendingImages = Array.from(frameDocument?.images || [])
    .filter((image) => !image.complete)
    .map((image) => new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    }));
  await Promise.all(pendingImages);
}

async function loadAnalyticsPageForExport(page, filters, routeParams = {}) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("height", "1000");
  frame.setAttribute("width", "1440");
  frame.style.cssText = "position:fixed;left:-100000px;top:0;width:1440px!important;min-width:1440px!important;max-width:none!important;height:1000px;border:0;opacity:0;pointer-events:none;";
  const route = analyticsPageRoutes[page];
  const query = new URLSearchParams({
    analytics_export: "true",
    export_filters: JSON.stringify(filters || {}),
    ...routeParams,
  });
  frame.src = `${route}?${query}`;
  document.body.appendChild(frame);
  await new Promise((resolve, reject) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.addEventListener("error", () => reject(new Error(`Unable to load ${page} analytics.`)), { once: true });
  });
  const preparedPage = await waitForAnalyticsPage(frame);
  // Mobile Safari can omit linked stylesheet rules when html2canvas clones an
  // iframe document. An inline copy keeps the export faithful to the app UI.
  copyApplicationStylesToFrame(frame);
  await waitForFrameAssets(frame);
  return { frame, page: preparedPage };
}

async function captureAnalyticsPage(element, html2canvas, reportTitle, viewTitle) {
  const reportHeading = element.ownerDocument.createElement("header");
  reportHeading.className = "analytics-layout-pdf-heading";
  const eyebrow = element.ownerDocument.createElement("span");
  eyebrow.textContent = "RSS Analytics";
  const title = element.ownerDocument.createElement("h1");
  title.textContent = reportTitle;
  const subtitle = element.ownerDocument.createElement("p");
  subtitle.textContent = viewTitle;
  reportHeading.append(eyebrow, title, subtitle);
  element.prepend(reportHeading);
  element.classList.add("is-layout-pdf-export");
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rootRect = element.getBoundingClientRect();
    const breakElements = element.querySelectorAll([
      ":scope > .tour-filter-controls",
      ":scope > .executive-brief",
      ":scope > .analytics-workspace > *",
      ":scope > .costs-margin-workspace > *",
      ".analytics-overview-links > .analytics-preview-card",
      ".analytics-temporal-rankings__grid > article",
      ".analytics-ranking-grid > .analytics-ranking",
      ".analytics-insights > .analytics-insight",
      ".analytics-location-health tbody > tr",
      ".location-performance-cards > article",
    ].join(","));
    const captureHeight = Math.max(
      element.scrollHeight,
      element.offsetHeight,
      Math.ceil(element.getBoundingClientRect().height),
    );
    const canvas = await html2canvas(element, {
      backgroundColor: "#f4f7fb",
      height: captureHeight,
      logging: false,
      scale: 1.35,
      useCORS: true,
      windowHeight: captureHeight,
      windowWidth: Math.max(1280, element.scrollWidth),
    });
    const scaleY = canvas.height / Math.max(1, captureHeight);
    const breakpoints = Array.from(breakElements)
      .map((child) => Math.round((child.getBoundingClientRect().top - rootRect.top) * scaleY))
      .filter((position) => position > 0 && position < canvas.height)
      .sort((first, second) => first - second);
    const repeatingHeaders = Array.from(element.querySelectorAll(".analytics-location-health"))
      .map((section) => {
        const heading = section.querySelector(".analytics-location-health__scroll > header");
        const tableHeading = section.querySelector("thead");
        const firstRow = section.querySelector("tbody > tr");
        if (!heading || !tableHeading || !firstRow) return null;
        const sectionRect = section.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const firstRowRect = firstRow.getBoundingClientRect();
        return {
          contentStart: Math.round((firstRowRect.top - rootRect.top) * scaleY),
          headerHeight: Math.round((firstRowRect.top - headingRect.top) * scaleY),
          headerY: Math.round((headingRect.top - rootRect.top) * scaleY),
          sourceEnd: Math.round((sectionRect.bottom - rootRect.top) * scaleY),
        };
      })
      .filter((header) => (
        header
        && header.headerHeight > 0
        && header.headerY >= 0
        && header.sourceEnd <= canvas.height
      ));
    return { breakpoints, canvas, repeatingHeaders };
  } finally {
    element.classList.remove("is-layout-pdf-export");
    reportHeading.remove();
  }
}

function exportViewVariants(page, viewScope) {
  if (viewScope !== "all") {
    return [{
      label: "Current view",
      params: {},
    }];
  }
  if (["locations", "leadSources", "staff"].includes(page)) {
    return [
      { label: "Volume metrics", params: { insight_mode: "volume" } },
      { label: "Rate metrics", params: { insight_mode: "rate" } },
    ];
  }
  if (page === "cohort") {
    return [
      { label: "Conversion Rate", params: { export_metric: "conversion" } },
      { label: "Toured Rate", params: { export_metric: "toured" } },
      { label: "Close Rate", params: { export_metric: "close" } },
      { label: "Average Days to Enrollment", params: { export_metric: "average_days" } },
    ];
  }
  if (page !== "volume") {
    return [{
      label: page === "overview" ? "Analytics overview" : "Financial overview and location performance",
      params: {},
    }];
  }
  return [
    { label: "All Events", params: {} },
    { label: "Booked", params: { focus: "scheduled" } },
    { label: "Toured", params: { focus: "toured" } },
    { label: "No Show", params: { focus: "no_show" } },
    { label: "Enrolled", params: { focus: "enrolled" } },
    { label: "Churned", params: { focus: "churned" } },
  ];
}

function appendCanvasPages(pdf, capture, hasExistingPage) {
  const { breakpoints, canvas, repeatingHeaders = [] } = capture;
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const sourcePageHeight = Math.max(1, Math.floor((usableHeight * canvas.width) / imageWidth));
  const segmentEdges = [0, ...breakpoints, canvas.height]
    .filter((position, index, positions) => index === 0 || position > positions[index - 1])
    .filter((position) => position >= 0 && position <= canvas.height);
  let cursorY = 0;
  let hasPage = hasExistingPage;

  const addSlice = (sourceY, currentSliceHeight) => {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = currentSliceHeight;
    const context = slice.getContext("2d");
    context.fillStyle = "#f4f7fb";
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      canvas.width,
      currentSliceHeight,
    );
    const renderedHeight = (currentSliceHeight * imageWidth) / canvas.width;
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.94),
      "JPEG",
      margin,
      margin + cursorY,
      imageWidth,
      renderedHeight,
      undefined,
      "FAST",
    );
    cursorY += renderedHeight;
  };

  const continuationHeaderFor = (sourceY) => repeatingHeaders.find((header) => (
    sourceY >= header.contentStart && sourceY < header.sourceEnd
  ));

  const startPage = (sourceY = null) => {
    if (hasPage) pdf.addPage();
    hasPage = true;
    cursorY = 0;
    const continuationHeader = sourceY === null ? null : continuationHeaderFor(sourceY);
    if (continuationHeader) {
      addSlice(continuationHeader.headerY, continuationHeader.headerHeight);
    }
  };

  startPage();
  for (let index = 0; index < segmentEdges.length - 1; index += 1) {
    const segmentStart = segmentEdges[index];
    let sourceY = segmentStart;
    let remainingSourceHeight = segmentEdges[index + 1] - segmentStart;
    if (remainingSourceHeight <= 0) continue;

    const availableSourceHeight = Math.max(
      0,
      Math.floor(((usableHeight - cursorY) * canvas.width) / imageWidth),
    );
    const nextSegmentHeight = index + 2 < segmentEdges.length
      ? segmentEdges[index + 2] - segmentEdges[index + 1]
      : 0;
    const isShortLeadIn = remainingSourceHeight < sourcePageHeight * 0.28;
    const nextWillNotFit = remainingSourceHeight + nextSegmentHeight > availableSourceHeight;
    if (cursorY > 0 && isShortLeadIn && nextWillNotFit) {
      startPage(sourceY);
    }

    while (remainingSourceHeight > 0) {
      const availableRenderedHeight = usableHeight - cursorY;
      const segmentRenderedHeight = (remainingSourceHeight * imageWidth) / canvas.width;

      if (segmentRenderedHeight > availableRenderedHeight && cursorY > 0) {
        startPage(sourceY);
        continue;
      }

      const currentPageSourceCapacity = Math.max(
        1,
        Math.floor(((usableHeight - cursorY) * canvas.width) / imageWidth),
      );
      const sliceCount = Math.max(1, Math.ceil(remainingSourceHeight / currentPageSourceCapacity));
      const currentSliceHeight = Math.min(
        remainingSourceHeight,
        Math.ceil(remainingSourceHeight / sliceCount),
      );
      addSlice(sourceY, currentSliceHeight);
      sourceY += currentSliceHeight;
      remainingSourceHeight -= currentSliceHeight;
      if (remainingSourceHeight > 0) startPage(sourceY);
    }
  }
  return hasPage;
}

export async function exportAnalyticsLayoutPdf({ filters, onProgress, options, page, role }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const allPages = ["overview", "volume", "cohort", "locations", "leadSources"];
  if (["admin", "super_admin"].includes(role)) allPages.push("staff", "cost-margin");
  const pages = options.coverage === "all" ? allPages : [page];
  const views = pages.flatMap((targetPage) => (
    exportViewVariants(targetPage, options.viewScope).map((variant) => ({
      ...variant,
      page: targetPage,
    }))
  ));
  const exportFilters = options.dataScope === "all_authorized"
    ? Object.fromEntries(
      Object.entries(filters || {}).filter(([key]) => !["location", "locations", "lead_source", "lead_sources", "staff"].includes(key)),
    )
    : filters;
  const pdf = new jsPDF({ format: "letter", orientation: "landscape", unit: "pt" });
  let hasPage = false;

  for (const [viewIndex, view] of views.entries()) {
    let frame;
    try {
      onProgress?.({
        current: viewIndex + 1,
        label: `${analyticsPageLabels[view.page] || "Analytics"} - ${view.label}`,
        total: views.length,
      });
      const prepared = await loadAnalyticsPageForExport(view.page, exportFilters, view.params);
      frame = prepared.frame;
      const element = prepared.page;
      const capture = await captureAnalyticsPage(
        element,
        html2canvas,
        analyticsPageLabels[view.page] || "Analytics",
        view.label,
      );
      hasPage = appendCanvasPages(pdf, capture, hasPage);
    } finally {
      frame?.remove();
    }
  }
  const pageCount = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(91, 109, 134);
    pdf.text(
      `RSS Analytics · ${pageNumber} of ${pageCount}`,
      pdf.internal.pageSize.getWidth() - 18,
      pdf.internal.pageSize.getHeight() - 6,
      { align: "right" },
    );
  }
  pdf.save(analyticsPdfFallbackFilename({ ...options, page }));
  return { total: views.length };
}

export async function getAnalyticsDrillThrough(params = {}) {
  const response = await api.get("/analytics/drill-through/", { params });
  return response.data;
}

export async function exportAnalyticsDrillThrough(params = {}) {
  const response = await api.get("/analytics/drill-through/", {
    params: { ...params, export: "xlsx" },
    responseType: "blob",
  });
  const disposition = response.headers["content-disposition"] || "";
  const safeFilenamePart = (value) => String(value || "")
    .split("")
    .map((character) => character.charCodeAt(0) < 32 ? "-" : character)
    .join("")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/^[ .-]+|[ .-]+$/g, "");
  const generatedName = [
    params.drill_page,
    params.drill_section,
    params.drill_visualization,
    params.drill_kpi,
  ].map(safeFilenamePart).filter(Boolean).join(" - ").slice(0, 180).replace(/[ .-]+$/g, "");
  const filename = responseFilename(disposition)
    || `${generatedName || "Analytics Drill-Through"}.xlsx`;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
