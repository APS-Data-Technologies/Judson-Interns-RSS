import { CalendarDays, Filter, MapPin, Search } from "lucide-react";

import {
  currentMonthValue,
  currentYearValue,
  datePresetOptions,
  statusOptions,
} from "../../features/tours/filterConfig";
import "./TourFilterControls.css";

function getSummary(values, options, fallback) {
  if (!values.length) return fallback;
  if (values.length === 1) {
    return options.find((option) => String(option.value) === String(values[0]))?.label || fallback;
  }
  return `${values.length} selected`;
}

function MultiFilter({ icon: Icon, label, values, options, fallback, disabled, onChange }) {
  function toggleValue(value) {
    if (values.includes(String(value))) {
      onChange(values.filter((item) => item !== String(value)));
      return;
    }
    onChange([...values, String(value)]);
  }

  return (
    <details className="tour-filter">
      <summary className="tour-filter__summary">
        <Icon aria-hidden="true" />
        <span>
          <small>{label}</small>
          <strong>{getSummary(values, options, fallback)}</strong>
        </span>
      </summary>
      <div className="tour-filter__menu">
        {!disabled && values.length > 0 && (
          <button
            className="tour-filter__clear"
            type="button"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        )}
        {options.map((option) => (
          <label className="tour-filter__option" key={option.value}>
            <input
              type="checkbox"
              checked={values.includes(String(option.value))}
              disabled={disabled}
              onChange={() => toggleValue(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

function DateFilter({ filters, onChange }) {
  return (
    <div className="tour-filter tour-filter--date">
      <div className="tour-filter__summary tour-filter__summary--static">
        <CalendarDays aria-hidden="true" />
        <span>
          <small>Date</small>
          <select
            value={filters.datePreset}
            onChange={(event) => onChange("datePreset", event.target.value)}
          >
            {datePresetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </span>
      </div>

      {filters.datePreset === "custom" && (
        <div className="tour-filter__range">
          <input
            aria-label="Start date"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onChange("dateFrom", event.target.value)}
          />
          <input
            aria-label="End date"
            type="date"
            value={filters.dateTo}
            onChange={(event) => onChange("dateTo", event.target.value)}
          />
        </div>
      )}

      {filters.datePreset === "month" && (
        <input
          aria-label="Month"
          className="tour-filter__single-input"
          type="month"
          value={filters.month}
          onChange={(event) => onChange("month", event.target.value || currentMonthValue())}
        />
      )}

      {filters.datePreset === "year" && (
        <input
          aria-label="Year"
          className="tour-filter__single-input"
          max="2100"
          min="2000"
          type="number"
          value={filters.year}
          onChange={(event) => onChange("year", event.target.value || currentYearValue())}
        />
      )}
    </div>
  );
}

function TourFilterControls({
  filters,
  leadSources,
  locations,
  onChange,
  searchPlaceholder = "Search family name",
  showStatus = true,
  staffLocationOnly = false,
}) {
  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: location.location_name,
  }));
  const leadSourceOptions = leadSources.map((source) => ({
    value: source.id,
    label: source.source_name,
  }));

  return (
    <div className="tour-filters" aria-label="Tour filters">
      <DateFilter filters={filters} onChange={onChange} />

      <label className="tour-filter tour-filter--search">
        <Search aria-hidden="true" />
        <span>
          <small>Search family</small>
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={(event) => onChange("search", event.target.value)}
          />
        </span>
      </label>

      <MultiFilter
        disabled={staffLocationOnly}
        fallback={staffLocationOnly ? "Assigned location" : "All locations"}
        icon={MapPin}
        label="Location"
        onChange={(values) => onChange("locations", values)}
        options={locationOptions}
        values={filters.locations}
      />

      <MultiFilter
        fallback="All sources"
        icon={Filter}
        label="Lead source"
        onChange={(values) => onChange("leadSources", values)}
        options={leadSourceOptions}
        values={filters.leadSources}
      />

      {showStatus && (
        <MultiFilter
          fallback="All statuses"
          icon={Filter}
          label="Status"
          onChange={(values) => onChange("statuses", values)}
          options={statusOptions}
          values={filters.statuses}
        />
      )}
    </div>
  );
}

export default TourFilterControls;
