# Refresh, Loading, Limits, Retention, and Operations

## Current refresh model

Analytics are calculated synchronously on request.

- Opening a page triggers a backend request.
- Changing master filters triggers another request.
- Ranking configuration changes trigger another request.
- Costs & Margin loads selected and comparison periods and recalculates when month or location selections change.
- Results represent committed database state at calculation time.

There is currently no scheduled refresh, cache, materialized view, snapshot, refresh job, or “last successful refresh” record.

## Current frontend loading behavior

- The title bar shows an analytics loading indicator.
- Components retain an `isCurrent` guard so an older request does not overwrite newer state.
- Requests are not consistently aborted when filters change.
- Standard analytics can fall back to a reduced browser-side calculation based on tour API data.
- Costs & Margin reports a load failure rather than using that fallback.

The browser fallback is a consistency risk and should be removed or formally constrained after backend reliability is established.

## Current operational limits

| Area | Current behavior |
|---|---|
| Main analytics response | No explicit record or date-range maximum |
| All-time analytics | Processes all authorized history |
| Trend display | Longer series are grouped/compressed |
| Drill-through | First 100 authorized tour records |
| Global search | Five database results per group by default |
| Cost-basis management list | Pagination disabled |
| Excel export | Generated synchronously |
| Visual PDF | Captures the rendered current analytics page in the browser |
| Export jobs | No queue, status history, expiration, or retry |

## Current retention and purge behavior

- Tour APIs do not expose deletion.
- Tour events preserve status history.
- Important foreign keys use `PROTECT`.
- Locations, lead sources, users, and cost-basis rows use active/inactive states.
- Cost-basis APIs expose create, retrieve, list, and update, but not delete.
- Active cost-basis rows contribute to financial analytics.
- There is no analytics purge command or retention job.
- `database/backups/` is not an engine-managed backup or restoration mechanism.

## Recommended operational policy

1. Preserve tours, tour events, and financial facts by default.
2. Use deactivation for dimensions and financial rows.
3. Define an audited correction process for incorrect history.
4. Permit purge only for approved legal or administrative requirements.
5. Separate retention policy from database backup policy.
6. Define backup frequency, restore testing, and recovery objectives outside the analytics request path.

## Required future metadata

Every analytics response should include:

- Calculation timestamp
- Data-through timestamp/date
- Effective time zone
- Metric version
- Executive-rule version
- Effective filters
- Selected and comparison periods
- Partial/truncated indicators
- Fallback-timestamp count

## Performance work sequence

1. Measure endpoint duration, query count, records processed, response size, and export duration.
2. Split page-specific endpoints.
3. Optimize database aggregation and indexes.
4. Add short-lived caching only where measurements justify it.
5. Add pre-aggregation or background export jobs only when synchronous limits are exceeded.

## Limits requiring product decisions

- Maximum interactive date range
- Maximum all-time volume
- Synchronous export row and duration limits
- Background-export threshold
- Cache duration and invalidation rules
- Drill-through preview size
- API timeout and retry policy
- Retention period
- Correction and purge approval policy
