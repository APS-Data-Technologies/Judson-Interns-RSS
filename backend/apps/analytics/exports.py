from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .services import cohort_analytics


PAGE_LABELS = {
    "overview": "Overview",
    "volume": "Volume & Trend",
    "cohort": "Conversion & Cohort",
    "locations": "Location",
    "leadSources": "Lead Source",
    "staff": "Staff",
    "cost-margin": "Costs & Margin",
}
PUBLIC_PAGES = ["overview", "volume", "cohort", "locations", "leadSources"]
RESTRICTED_PAGES = ["staff", "cost-margin"]


def allowed_pages(user):
    role = getattr(user, "role", "")
    return PUBLIC_PAGES + (RESTRICTED_PAGES if role in {"admin", "super_admin"} else [])


def _rows(data, page):
    if page == "overview":
        labels = {
            "scheduled": "Booked",
            "toured": "Toured",
            "no_show": "No Show",
            "enrolled": "Enrolled",
            "churned": "Churned",
        }
        return [
            ["Metric", "Current", "Previous"],
            *[
                [labels.get(key, key), value, data.get("previousCounts", {}).get(key, 0)]
                for key, value in data.get("counts", {}).items()
            ],
        ]
    if page == "volume":
        return [
            ["Period", "Booked", "Toured", "No Show", "Enrolled", "Churned"],
            *[
                [
                    row.get("label"),
                    row.get("scheduled", 0),
                    row.get("toured", 0),
                    row.get("no_show", 0),
                    row.get("enrolled", 0),
                    row.get("churned", 0),
                ]
                for row in data.get("volumeTrendData", [])
            ],
        ]
    if page == "cohort":
        rates = data.get("rates", {})
        return [
            ["Metric", "Value", "Change"],
            ["Toured Rate", rates.get("toured"), data.get("rateDeltas", {}).get("toured")],
            ["No Show Rate", rates.get("no_show"), data.get("rateDeltas", {}).get("no_show")],
            ["Close Rate", rates.get("close"), data.get("rateDeltas", {}).get("close")],
            ["Conversion Rate", rates.get("conversion"), data.get("rateDeltas", {}).get("conversion")],
            ["Average Days to Enroll", data.get("averageDaysToEnroll"), ""],
        ]
    if page in {"locations", "leadSources", "staff"}:
        return _entity_rows(data.get("entityHealth", {}).get(page, []))
    if page == "cost-margin":
        financial = data.get("financialSummary", {})
        return [
            ["Metric", "Value"],
            ["Revenue", financial.get("revenue", 0)],
            ["Costs", financial.get("cost", 0)],
            ["Contribution Margin", financial.get("margin", 0)],
            [],
            ["Month", "Revenue", "Costs", "Contribution Margin", "Margin %"],
            *[
                [row.get("label"), row.get("revenue"), row.get("cost"), row.get("margin"), row.get("marginRate")]
                for row in data.get("financialTrend", [])
            ],
        ]
    return [["No data"]]


def _entity_rows(rows):
    headers = ["Name", "Booked", "Toured", "No Show", "Enrolled", "Churned", "Conversion %"]
    output = [headers]
    for row in rows:
        current = row.get("current", row)
        output.append([
            row.get("name", row.get("label", "—")),
            current.get("scheduled", current.get("booked", 0)),
            current.get("toured", 0),
            current.get("no_show", current.get("noShow", 0)),
            current.get("enrolled", 0),
            current.get("churned", 0),
            current.get("conversionRate", current.get("conversion", 0)),
        ])
    return output


def export_analytics(user, payload):
    coverage = payload.get("coverage", "current")
    current_page = payload.get("page", "overview")
    pages = allowed_pages(user)
    selected_pages = pages if coverage == "all" else [current_page]
    selected_pages = [page for page in selected_pages if page in pages]

    params = dict(payload.get("filters") or {})
    if payload.get("viewScope") == "all":
        for key in ("metric", "ranking_metric", "ranking_sort", "cost_basis"):
            params.pop(key, None)
    if payload.get("dataScope") == "all_authorized":
        for key in ("location", "locations", "lead_source", "lead_sources", "staff"):
            params.pop(key, None)
    data = cohort_analytics(user, params)
    if payload.get("format") == "pdf":
        return _pdf(data, selected_pages, params), "application/pdf", "analytics-report.pdf"
    return _excel(data, selected_pages, params), (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ), "analytics-data.xlsx"


def _excel(data, pages, params):
    workbook = Workbook()
    workbook.remove(workbook.active)
    filters = workbook.create_sheet("Filters & Definitions")
    filters.append(["Filter", "Value"])
    for key, value in sorted(params.items()):
        filters.append([key.replace("_", " ").title(), ", ".join(value) if isinstance(value, list) else value])
    filters.append([])
    filters.append(["Definition", "Meaning"])
    filters.append(["Current selections", "Values and page controls selected when the export was generated."])
    filters.append(["All authorized data", "Entity filters removed; role and location permissions remain enforced."])

    for page in pages:
        sheet = workbook.create_sheet(PAGE_LABELS[page][:31])
        for row in _rows(data, page):
            sheet.append(row)
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="163968")
        for column in sheet.columns:
            width = min(40, max(12, max(len(str(cell.value or "")) for cell in column) + 2))
            sheet.column_dimensions[column[0].column_letter].width = width

    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def _pdf(data, pages, params):
    stream = BytesIO()
    document = SimpleDocTemplate(
        stream,
        pagesize=landscape(letter),
        leftMargin=0.45 * inch,
        rightMargin=0.45 * inch,
        topMargin=0.45 * inch,
        bottomMargin=0.45 * inch,
    )
    styles = getSampleStyleSheet()
    story = [Paragraph("Analytics Report", styles["Title"])]
    filter_text = " · ".join(f"{key.replace('_', ' ').title()}: {value}" for key, value in sorted(params.items()))
    if filter_text:
        story.extend([Paragraph(filter_text, styles["BodyText"]), Spacer(1, 10)])
    for index, page in enumerate(pages):
        if index:
            story.append(PageBreak())
        story.append(Paragraph(PAGE_LABELS[page], styles["Heading1"]))
        rows = _rows(data, page)
        column_count = max(len(row) for row in rows)
        normalized_rows = [
            [str(value if value is not None else "—") for value in row] + [""] * (column_count - len(row))
            for row in rows
        ]
        table = Table(normalized_rows, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#163968")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCD7E6")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F8FC")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(table)
    document.build(story)
    return stream.getvalue()
