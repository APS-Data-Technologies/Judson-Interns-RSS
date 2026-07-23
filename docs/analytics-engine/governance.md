# Analytics Governance and Change Control

## Ownership

Every metric must eventually identify:

- Business owner
- Technical owner
- Formula
- Grain
- Date basis
- Source population
- Filters and exclusions
- Empty/zero behavior
- Permission level
- UI and export consumers
- Metric version and effective date
- Automated tests

## Formula control

Core formulas remain in Django code. Admins and super admins cannot rewrite formulas through the UI.

A core formula change requires:

1. Business approval.
2. Metric-catalog update.
3. Backend implementation change.
4. Metric-version increment.
5. Unit and reconciliation tests.
6. Review of executive-summary dependencies.
7. Review of drill-through and export behavior.
8. Cache invalidation or historical recalculation plan.
9. Code review and deployment.
10. Change-log entry with effective date.

## Safe future configuration

Potential super-admin settings:

- Default reporting period
- Maximum interactive history
- Cache duration
- Approved alert thresholds
- Comparison-period default
- Enable/disable noncritical deterministic findings

Each change must be validated, versioned, audited, previewable, and reversible.

Not allowed:

- Editable Python
- Editable SQL
- Editable JavaScript
- `eval()` or equivalent expression execution
- Silent retrospective formula changes
- Permission broadening through analytics settings

## Reconciliation

For an identical permission scope, metric version, and filter set:

- Headline values must equal their chart aggregates.
- Drill-through must explain the same population.
- Excel must reproduce the canonical numeric result.
- Executive-summary statements must cite values from the same response.
- Visual PDF must reproduce the displayed state.

## Review cadence

- Metric catalog: review before every analytics release.
- Permission matrix: review whenever roles or routes change.
- Executive rules: review when thresholds or business priorities change.
- Operations and limits: review after performance incidents or major data growth.
- Retention policy: review with organizational and legal stakeholders.

## Release checklist

- Documentation updated
- Metric and rule versions assigned
- Permission tests passed
- Period-boundary tests passed
- Financial reconciliation passed
- Drill-through reconciliation passed
- Excel reconciliation passed
- Frontend lint/build passed
- Backend analytics tests passed
- Performance change measured
- Change log updated
