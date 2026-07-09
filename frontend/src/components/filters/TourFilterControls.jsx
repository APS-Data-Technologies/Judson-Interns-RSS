import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCheck,
  ChevronDown,
  CircleDot,
  DollarSign,
  Eraser,
  RadioTower,
  MapPin,
  Search,
} from "lucide-react";

import {
  datePresetOptions,
  statusOptions,
} from "../../features/tours/filterConfig";
import "./TourFilterControls.css";

const datePresetRows = [
  ["yesterday", "today", "tomorrow"],
  ["last_7_days", "last_30_days"],
];

function getSummary(values, options, fallback) {
  if (!values.length) return fallback;
  if (values.length === options.length) return "All selected";
  if (values.length === 1) {
    return options.find((option) => String(option.value) === String(values[0]))?.label || fallback;
  }
  return `${values.length} selected`;
}

function FilterShell({ children, icon: Icon, isOpen, label, onToggle, summary }) {
  return (
    <div className={`tour-filter ${isOpen ? "tour-filter--open" : ""}`}>
      <button
        className="tour-filter__summary"
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <Icon aria-hidden="true" />
        <span>
          <small>{label}</small>
          <strong>{summary}</strong>
        </span>
        <ChevronDown className="tour-filter__chevron" aria-hidden="true" />
      </button>
      {isOpen && children}
    </div>
  );
}

function MultiFilter({
  disabled,
  fallback,
  icon,
  isOpen,
  label,
  onChange,
  onToggle,
  options,
  values,
}) {
  function toggleValue(value) {
    const nextValue = String(value);
    if (values.includes(nextValue)) {
      onChange(values.filter((item) => item !== nextValue));
      return;
    }
    onChange([...values, nextValue]);
  }

  return (
    <FilterShell
      icon={icon}
      isOpen={isOpen}
      label={label}
      onToggle={onToggle}
      summary={getSummary(values, options, fallback)}
    >
      <div className="tour-filter__menu">
        <div className="tour-filter__toolbar">
          <button
            type="button"
            aria-label={`Select all ${label}`}
            disabled={disabled}
            onClick={() => onChange(options.map((option) => String(option.value)))}
          >
            <CheckCheck aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Clear ${label}`}
            disabled={disabled || values.length === 0}
            onClick={() => onChange([])}
          >
            <Eraser aria-hidden="true" />
          </button>
        </div>
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
    </FilterShell>
  );
}

function DateFilter({ filters, isOpen, onChange, onToggle }) {
  const selectedOption =
    datePresetOptions.find((option) => option.value === filters.datePreset) ||
    datePresetOptions[0];
  const optionsByValue = new Map(datePresetOptions.map((option) => [option.value, option]));

  return (
    <FilterShell
      icon={CalendarDays}
      isOpen={isOpen}
      label="Date"
      onToggle={onToggle}
      summary={selectedOption.label}
    >
      <div className="tour-filter__menu tour-filter__menu--date">
        {datePresetRows.map((row) => (
          <div className="tour-filter__preset-row" key={row.join("-")}>
            {row.map((value) => {
              const option = optionsByValue.get(value);
              return (
                <button
                  className="tour-filter__preset"
                  type="button"
                  key={option.value}
                  aria-pressed={filters.datePreset === option.value}
                  onClick={() => onChange("datePreset", option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ))}

        <div className="tour-filter__range">
          <label>
            <small>From</small>
            <input
              aria-label="Start date"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => {
                onChange("datePreset", "custom");
                onChange("dateFrom", event.target.value);
              }}
            />
          </label>
          <label>
            <small>To</small>
            <input
              aria-label="End date"
              type="date"
              value={filters.dateTo}
              onChange={(event) => {
                onChange("datePreset", "custom");
                onChange("dateTo", event.target.value);
              }}
            />
          </label>
        </div>
      </div>
    </FilterShell>
  );
}

function TourFilterControls({
  costBasis,
  filters,
  leadSources,
  locations,
  onChange,
  onCostBasisChange,
  searchPlaceholder = "Search family name",
  showCostBasis = false,
  showLeadSource = true,
  showSearch = true,
  showStatus = true,
  staffLocationOnly = false,
}) {
  const [openFilter, setOpenFilter] = useState("");
  const filtersRef = useRef(null);
  const filterClassNames = [
    "tour-filters",
    !showSearch ? "tour-filters--no-search" : "",
    !showLeadSource ? "tour-filters--no-lead-source" : "",
    !showStatus ? "tour-filters--no-status" : "",
    showCostBasis ? "tour-filters--with-cost" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: location.location_name,
  }));
  const leadSourceOptions = leadSources.map((source) => ({
    value: source.id,
    label: source.source_name,
  }));

  useEffect(() => {
    function handlePointerDown(event) {
      if (!filtersRef.current?.contains(event.target)) {
        setOpenFilter("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function toggleFilter(name) {
    setOpenFilter((currentFilter) => (currentFilter === name ? "" : name));
  }

  return (
    <div
      className={filterClassNames}
      ref={filtersRef}
      aria-label="Tour filters"
    >
      <DateFilter
        filters={filters}
        isOpen={openFilter === "date"}
        onChange={onChange}
        onToggle={() => toggleFilter("date")}
      />

      {showSearch && (
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
      )}

      <MultiFilter
        disabled={staffLocationOnly}
        fallback={staffLocationOnly ? "Assigned location" : "All locations"}
        icon={MapPin}
        isOpen={openFilter === "locations"}
        label="Location"
        onChange={(values) => onChange("locations", values)}
        onToggle={() => toggleFilter("locations")}
        options={locationOptions}
        values={filters.locations}
      />

      {showLeadSource && (
        <MultiFilter
          fallback="All sources"
          icon={RadioTower}
          isOpen={openFilter === "leadSources"}
          label="Lead source"
          onChange={(values) => onChange("leadSources", values)}
          onToggle={() => toggleFilter("leadSources")}
          options={leadSourceOptions}
          values={filters.leadSources}
        />
      )}

      {showStatus && (
        <MultiFilter
          fallback="All statuses"
          icon={CircleDot}
          isOpen={openFilter === "statuses"}
          label="Status"
          onChange={(values) => onChange("statuses", values)}
          onToggle={() => toggleFilter("statuses")}
          options={statusOptions}
          values={filters.statuses}
        />
      )}

      {showCostBasis && (
        <label className="tour-filter tour-filter--cost">
          <DollarSign aria-hidden="true" />
          <span>
            <small>Cost basis</small>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="Optional"
              value={costBasis}
              onChange={(event) => onCostBasisChange(event.target.value)}
            />
          </span>
        </label>
      )}
    </div>
  );
}

export default TourFilterControls;
