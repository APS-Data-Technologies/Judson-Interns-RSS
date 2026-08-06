import api from "../../services/api/api";
import readySetStemLogo from "../../assets/brand/logo-horizontal.png";
import { APPLICATION_TIME_ZONE } from "../../utils/timeZone";
import { buildAnalyticsPaginationBoundaries } from "./analyticsPagination";

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
  const frameDocument = frame.contentDocument;
  const viewportMeta = frameDocument?.querySelector('meta[name="viewport"]');
  if (viewportMeta) viewportMeta.setAttribute("content", "width=1440, initial-scale=1");
  if (frameDocument?.documentElement) {
    frameDocument.documentElement.style.cssText += "width:1440px!important;min-width:1440px!important;max-width:1440px!important;";
  }
  if (frameDocument?.body) {
    frameDocument.body.style.cssText += "width:1440px!important;min-width:1440px!important;max-width:1440px!important;";
  }
  // Mobile Safari can omit linked stylesheet rules when html2canvas clones an
  // iframe document. An inline copy keeps the export faithful to the app UI.
  copyApplicationStylesToFrame(frame);
  await waitForFrameAssets(frame);
  return { frame, page: preparedPage };
}

async function captureAnalyticsPage(element, html2canvas, reportTitle, viewTitle, compactVariant = false) {
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
  if (compactVariant) element.classList.add("is-layout-pdf-export--compact-variant");
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rootRect = element.getBoundingClientRect();
    const breakElements = element.querySelectorAll([
      ":scope > .tour-filter-controls",
      ":scope > .executive-brief",
      ":scope > .analytics-workspace > *",
      ":scope > .costs-margin-workspace > *",
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
    const rangeForElements = (startElement, endElement = startElement, startBleed = 0) => {
      if (!startElement || !endElement) return null;
      const startRect = startElement.getBoundingClientRect();
      const endRect = endElement.getBoundingClientRect();
      const start = Math.max(0, Math.round((startRect.top - rootRect.top - startBleed) * scaleY));
      const end = Math.min(canvas.height, Math.round((endRect.bottom - rootRect.top) * scaleY));
      return end > start ? { start, end } : null;
    };
    const breakpoints = Array.from(breakElements)
      .map((child) => Math.round((child.getBoundingClientRect().top - rootRect.top) * scaleY))
      .filter((position) => position > 0 && position < canvas.height)
      .sort((first, second) => first - second);
    const keepTogetherRanges = Array.from(element.querySelectorAll([
      ":scope > .analytics-workspace h2",
      ":scope > .analytics-workspace h3",
      ":scope > .costs-margin-workspace h2",
      ":scope > .costs-margin-workspace h3",
    ].join(",")))
      .map((heading) => {
        const block = heading.closest("section, article");
        if (!block || !element.contains(block)) return null;
        const blockRect = block.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        return {
          start: Math.max(0, Math.round((blockRect.top - rootRect.top) * scaleY)),
          headingEnd: Math.min(canvas.height, Math.round((headingRect.bottom - rootRect.top) * scaleY)),
          end: Math.min(canvas.height, Math.round((blockRect.bottom - rootRect.top) * scaleY)),
        };
      })
      .filter((range) => range && range.end > range.start)
      .filter((range, index, ranges) => (
        ranges.findIndex((candidate) => candidate.start === range.start && candidate.end === range.end) === index
      ))
      .sort((first, second) => (
        first.start - second.start || (first.end - first.start) - (second.end - second.start)
      ));
    const atomicRanges = [
      ...Array.from(element.querySelectorAll(":scope > .analytics-workspace > .analytics-period"))
        .map((period) => rangeForElements(period, period.nextElementSibling || period, 8)),
      ...Array.from(element.querySelectorAll(".analytics-temporal-rankings"))
        .map((section) => rangeForElements(section, section, 8)),
      ...Array.from(element.querySelectorAll(".analytics-volume-performance-rankings"))
        .map((section) => rangeForElements(section, section, 8)),
      ...Array.from(element.querySelectorAll(".analytics-cohort-ranking-banner"))
        .map((banner) => rangeForElements(
          banner,
          banner.nextElementSibling?.classList.contains("analytics-cohort-performance-rankings")
            ? banner.nextElementSibling
            : banner,
          8,
        )),
      ...Array.from(element.querySelectorAll(".analytics-workspace--overview > .analytics-overview-section"))
        .map((section) => rangeForElements(section, section, 8)),
      ...Array.from(element.querySelectorAll(".location-performance-section"))
        .map((section) => {
          const firstRowCards = Array.from(section.querySelectorAll(".location-performance-cards > article")).slice(0, 3);
          return rangeForElements(section, firstRowCards.at(-1) || section, 8);
        }),
      ...Array.from(element.querySelectorAll(".analytics-summary-grid"))
        .map((summary) => rangeForElements(reportHeading, summary, 8)),
    ]
      .filter(Boolean)
      .filter((range, index, ranges) => (
        ranges.findIndex((candidate) => candidate.start === range.start && candidate.end === range.end) === index
      ))
      .sort((first, second) => first.start - second.start || first.end - second.end);
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
    return { atomicRanges, breakpoints, canvas, keepTogetherRanges, repeatingHeaders };
  } finally {
    element.classList.remove("is-layout-pdf-export");
    element.classList.remove("is-layout-pdf-export--compact-variant");
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

function appendCanvasPages(pdf, capture, hasExistingPage, pageLabel, pageContexts) {
  const { atomicRanges = [], breakpoints, canvas, keepTogetherRanges = [], repeatingHeaders = [] } = capture;
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const sourcePageHeight = Math.max(1, Math.floor((usableHeight * canvas.width) / imageWidth));
  const segmentEdges = buildAnalyticsPaginationBoundaries({
    atomicRanges,
    breakpoints,
    canvasHeight: canvas.height,
    keepTogetherStarts: keepTogetherRanges.map((range) => range.start),
    sourcePageHeight,
  });
  let cursorY = 0;
  let hasPage = hasExistingPage;
  let lastContentEnd = 0;

  const addSlice = (sourceY, currentSliceHeight, isRepeatedHeader = false) => {
    if (!isRepeatedHeader && sourceY < lastContentEnd) {
      throw new Error("Analytics PDF pagination cannot repeat or move backward through content.");
    }
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
    if (!isRepeatedHeader) lastContentEnd = sourceY + currentSliceHeight;
  };

  const continuationHeaderFor = (sourceY) => repeatingHeaders.find((header) => (
    sourceY >= header.contentStart && sourceY < header.sourceEnd
  ));
  const keepTogetherRangeFor = (sourceY) => keepTogetherRanges.find((range) => (
    Math.abs(range.start - sourceY) <= 2
  ));

  const startPage = (sourceY = null) => {
    if (hasPage) pdf.addPage();
    hasPage = true;
    cursorY = 0;
    pageContexts.set(pdf.internal.getCurrentPageInfo().pageNumber, pageLabel);
    const continuationHeader = sourceY === null ? null : continuationHeaderFor(sourceY);
    if (continuationHeader) {
      addSlice(continuationHeader.headerY, continuationHeader.headerHeight, true);
    }
  };

  startPage();
  for (let index = 0; index < segmentEdges.length - 1; index += 1) {
    const segmentStart = segmentEdges[index];
    let sourceY = segmentStart;
    let remainingSourceHeight = segmentEdges[index + 1] - segmentStart;
    if (remainingSourceHeight <= 0) continue;

    while (remainingSourceHeight > 0) {
      const availableRenderedHeight = usableHeight - cursorY;
      const segmentRenderedHeight = (remainingSourceHeight * imageWidth) / canvas.width;
      const availableSourceHeight = Math.max(
        1,
        Math.floor((availableRenderedHeight * canvas.width) / imageWidth),
      );
      const continuationHeader = continuationHeaderFor(sourceY);
      const freshPageCapacity = sourcePageHeight - (continuationHeader?.headerHeight || 0);
      const fitsOnFreshPage = remainingSourceHeight <= freshPageCapacity;
      const availableSpaceIsTooSmall = availableSourceHeight < sourcePageHeight * 0.14;
      const keepTogetherRange = keepTogetherRangeFor(sourceY);
      const keepTogetherHeight = keepTogetherRange
        ? keepTogetherRange.end - keepTogetherRange.start
        : 0;
      const headingHeight = keepTogetherRange
        ? Math.max(1, keepTogetherRange.headingEnd - keepTogetherRange.start)
        : 0;
      const requiredHeadingAndVisualHeight = keepTogetherRange
        ? Math.min(
          keepTogetherHeight,
          freshPageCapacity,
          Math.max(headingHeight * 2, Math.floor(freshPageCapacity * 0.42)),
        )
        : 0;
      const shouldMoveHeadingAndVisual = (
        cursorY > 0
        && requiredHeadingAndVisualHeight > availableSourceHeight
      );

      if (
        shouldMoveHeadingAndVisual
        || (
          segmentRenderedHeight > availableRenderedHeight
          && cursorY > 0
          && (fitsOnFreshPage || availableSpaceIsTooSmall)
        )
      ) {
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

function loadCoverLogo() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Unable to load the Ready Set STEM logo.")), { once: true });
    image.src = readySetStemLogo;
  });
}

function userDisplayName(user) {
  const combinedName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return user?.name || user?.full_name || combinedName || user?.email || "Authorized user";
}

function roleDisplayName(role) {
  return String(role || "user")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function addExecutiveCover(pdf, options, pages, views, user, logo) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const generatedAt = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: APPLICATION_TIME_ZONE,
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date());
  const coverage = options.coverage === "all"
    ? "All authorized analytics pages"
    : analyticsPageLabels[pages[0]] || "Current analytics page";
  const viewScope = options.viewScope === "all" ? "All available views" : "Current view";
  const dataScope = options.dataScope === "all_authorized"
    ? "All authorized data"
    : "Current filtered data";

  const navy = [10, 42, 86];
  const gold = [255, 190, 24];
  const body = [48, 62, 82];
  const border = [218, 226, 236];

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, width, height, "F");
  pdf.addImage(logo, "PNG", 48, 38, 209, 47, undefined, "FAST");
  pdf.setDrawColor(...gold);
  pdf.setLineWidth(2);
  pdf.line(48, 105, width - 48, 105);

  pdf.setTextColor(...navy);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(27);
  pdf.text("Tour-to-Enrollment", 48, 158);
  pdf.setTextColor(...gold);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(38);
  pdf.text("Analytics Report", 48, 202);

  pdf.setTextColor(...navy);
  pdf.setFontSize(13);
  pdf.text("Report Details", 48, 262);

  const details = [
    ["Report Coverage", coverage],
    ["Views Included", viewScope],
    ["Data Scope", dataScope],
    ["Report Views", String(views.length)],
  ];
  details.forEach(([label, value], index) => {
    const cardGap = 12;
    const cardWidth = (width - 96 - cardGap * 3) / 4;
    const x = 48 + index * (cardWidth + cardGap);
    pdf.setFillColor(249, 251, 254);
    pdf.setDrawColor(...border);
    pdf.setLineWidth(0.8);
    pdf.roundedRect(x, 282, cardWidth, 88, 7, 7, "FD");
    pdf.setTextColor(...navy);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(label.toUpperCase(), x + 12, 306);
    pdf.setTextColor(...body);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    const valueLines = pdf.splitTextToSize(value, cardWidth - 24);
    pdf.text(valueLines, x + 12, 334);
  });

  pdf.setDrawColor(...border);
  pdf.setLineWidth(0.8);
  pdf.line(48, height - 76, width - 48, height - 76);
  pdf.setTextColor(...body);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Generated by ${userDisplayName(user)} · ${roleDisplayName(user?.role)}`, 48, height - 48);
  pdf.text(generatedAt, width - 48, height - 48, { align: "right" });
}

export async function exportAnalyticsLayoutPdf({ filters, onProgress, options, page, role, user }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const allPages = ["overview", "volume", "cohort", "locations", "leadSources"];
  if (["admin", "super_admin"].includes(role)) allPages.push("staff", "cost-margin");
  const pages = options.coverage === "all" ? allPages : [page];
  const views = pages.flatMap((targetPage) => (
    exportViewVariants(targetPage, options.viewScope).map((variant, variantIndex) => ({
      ...variant,
      page: targetPage,
      variantIndex,
    }))
  ));
  const exportFilters = options.dataScope === "all_authorized"
    ? Object.fromEntries(
      Object.entries(filters || {}).filter(([key]) => !["location", "locations", "lead_source", "lead_sources", "staff"].includes(key)),
    )
    : { ...(filters || {}) };
  exportFilters.exclude_test_data = "true";
  const pdf = new jsPDF({ format: "letter", orientation: "landscape", unit: "pt" });
  pdf.setProperties({
    author: "Ready Set STEM",
    creator: "RSS Analytics",
    keywords: "RSS, analytics, executive report, performance",
    subject: "Leadership performance analytics",
    title: analyticsPdfFallbackFilename({ ...options, page }).replace(/\.pdf$/i, ""),
  });
  const coverLogo = await loadCoverLogo();
  addExecutiveCover(pdf, options, pages, views, user, coverLogo);
  const pageContexts = new Map([[1, "Executive report cover"]]);
  let hasPage = true;

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
        view.variantIndex > 0,
      );
      const pageLabel = `${analyticsPageLabels[view.page] || "Analytics"} - ${view.label}`;
      hasPage = appendCanvasPages(pdf, capture, hasPage, pageLabel, pageContexts);
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
      `${pageContexts.get(pageNumber) || "RSS Analytics"}  |  ${pageNumber} of ${pageCount}`,
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
