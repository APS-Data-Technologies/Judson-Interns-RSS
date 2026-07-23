# Current Gaps and Delivery Roadmap

## Current strengths

- Backend role and location scoping
- Separate event-date and cohort calculations
- Completed-month financial reporting
- Current and comparison periods
- Deterministic executive summaries
- Drill-through and export foundations
- Existing financial, permission, compression, export, and search tests
- Responsive analytics experience

## Current gaps

### Governance

- Metrics and rules do not yet have stable version identifiers.
- Business and technical owners are not assigned.
- No formal analytics change log exists.
- Retention and correction policies require organizational decisions.

### Architecture

- Core, metric, financial, ranking, and executive-rule functions are separated into focused modules.
- `cohort_analytics()` is a broad orchestration function.
- One endpoint calculates data for several pages.
- Some fallback calculations remain in the frontend.
- Page-specific contracts are not yet established.

### Explainability

- Responses do not expose calculation time, data-through date, version, or fallback counts.
- Drill-through does not yet return metric-specific numerator/denominator lineage for every clicked value.
- Missing-event timestamp fallbacks are not disclosed.

### Performance and operations

- No query timing or record-processing instrumentation
- No explicit maximum interactive range
- No cache or pre-aggregation
- No background export jobs
- No refresh status or operational health record
- No formal data-quality checks

### Data history

- Rescheduling changes the current scheduled date and can move cohort membership.
- Missing milestone events may fall back to `updated_at`.
- There is no audited historical-correction workflow.

## Delivery roadmap

### Deliverable 1 — Current-state specification

- Complete this documentation set.
- Review formulas, thresholds, permissions, and limitations with stakeholders.
- Assign owners and initial versions.

### Deliverable 2 — Modular engine

- Core filters/periods, canonical metrics, financials, rankings, and summaries are extracted.
- Compatibility imports preserve existing response behavior.
- Remaining work: isolate drill-through/export contracts and remove or constrain duplicate frontend calculations.

### Deliverable 3 — Page-specific API contracts

- Add focused Overview, Volume, Cohort, Location, Lead Source, Staff, and Costs & Margin endpoints.
- Add shared response metadata.
- Keep one canonical calculation implementation.

### Deliverable 4 — Quality and explainability

- Add data-quality checks.
- Add metric-specific drill-through lineage.
- Add data-through, version, partial, and fallback disclosures.
- Add reconciliation tests across UI data, drill-through, and Excel.

### Deliverable 5 — Performance and operations

- Instrument duration, query count, response size, and records processed.
- Set explicit product limits.
- Optimize queries and indexes.
- Introduce caching or pre-aggregation only where measured.

### Deliverable 6 — Read-only Analytics Administration

- Engine health
- Freshness
- Metric and rule catalog
- Permission matrix
- Data-quality warnings
- Effective versions

Refresh and cache controls should appear only after those capabilities exist. Formula editing remains outside the UI.
