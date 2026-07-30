import api from "../../services/api/api";

export async function getCohortAnalytics(params = {}) {
  const response = await api.get("/analytics/cohort/", { params });
  return response.data;
}

export async function exportAnalytics(payload) {
  const response = await api.post("/analytics/export/", payload, { responseType: "blob" });
  const disposition = response.headers["content-disposition"] || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1]
    || (payload.format === "pdf" ? "analytics-report.pdf" : "analytics-data.xlsx");
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const filename = disposition.match(/filename="([^"]+)"/)?.[1]
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

export async function exportVisualAnalyticsPdf(element, filename = "analytics-report.pdf") {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  element.classList.add("is-exporting-pdf");
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: "#f4f7fb",
      scale: Math.min(1.75, window.devicePixelRatio || 1),
      useCORS: true,
      windowHeight: element.scrollHeight,
      windowWidth: element.scrollWidth,
    });
    const pdf = new jsPDF({
      format: "letter",
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "pt",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    let remainingHeight = imageHeight;
    let position = 0;
    const image = canvas.toDataURL("image/jpeg", 0.94);
    pdf.addImage(image, "JPEG", 0, position, imageWidth, imageHeight, undefined, "FAST");
    remainingHeight -= pageHeight;
    while (remainingHeight > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(image, "JPEG", 0, position, imageWidth, imageHeight, undefined, "FAST");
      remainingHeight -= pageHeight;
    }
    pdf.save(filename);
  } finally {
    element.classList.remove("is-exporting-pdf");
  }
}
