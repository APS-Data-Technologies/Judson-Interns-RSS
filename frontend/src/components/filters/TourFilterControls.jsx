import { useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  CircleDot,
  DollarSign,
  Eraser,
  RadioTower,
  MapPin,
  Search,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";

import {
  categoryOptions,
  currentMonthValue,
  currentYearValue,
  defaultDatePreset,
  datePresetOptions,
  getDateRange,
  statusOptions,
} from "../../features/tours/filterConfig";
import { toTitleCaseWords } from "../../utils/displayText";
import "./TourFilterControls.css";

const datePresetRows = [
  ["all_time", "month_to_date", "year_to_date"],
  ["today", "yesterday", "last_30_days"],
];

function getSummary(values, options, fallback) {
  if (!values.length) return fallback;
  if (values.length === 1) {
    return options.find((option) => String(option.value) === String(values[0]))?.label || fallback;
  }
  if (values.length === options.length) return "All selected";
  return `${values.length} selected`;
}

function getDateSummary(filters) {
  if (filters.datePreset === "last_n_days") {
    return `Last ${filters.lastDays || 7} days`;
  }
  if (filters.datePreset === "next_n_days") {
    return `Next ${filters.nextDays || 7} days`;
  }
  return (
    datePresetOptions.find((option) => option.value === filters.datePreset)?.label ||
    datePresetOptions[0].label
  );
}

function RelativeDayPreset({ active, label, onDaysChange, onSelect, value }) {
  return (
    <div className={`tour-filter__relative-preset ${active ? "is-active" : ""}`}>
      <button type="button" onClick={onSelect}>
        {label}
      </button>
      <input
        aria-label={`${label} number of days`}
        inputMode="numeric"
        min="1"
        max="3650"
        type="number"
        value={value ?? 7}
        onFocus={onSelect}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue === "") {
            onDaysChange("");
            return;
          }
          onDaysChange(String(Math.min(Math.max(Number.parseInt(nextValue, 10) || 1, 1), 3650)));
        }}
      />
      <span>days</span>
    </div>
  );
}

function formatRangeLabel(datePreset) {
  const { dateFrom, dateTo } = getDateRange({ datePreset });
  const formatDate = (value) => new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
  return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`;
}

function DateOptionsContent({ filters, onChange, onPresetSelect }) {
  const optionsByValue = new Map(datePresetOptions.map((option) => [option.value, option]));
  const [draftDateFrom, setDraftDateFrom] = useState(filters.dateFrom || "");
  const [draftDateTo, setDraftDateTo] = useState(filters.dateTo || "");
  const [rangeError, setRangeError] = useState("");

  function applyCustomRange() {
    if (!draftDateFrom || !draftDateTo) {
      setRangeError("Select both From and To dates.");
      return;
    }
    if (draftDateTo < draftDateFrom) {
      setRangeError("To date cannot be earlier than From date.");
      return;
    }
    setRangeError("");
    onChange("dateFrom", draftDateFrom);
    onChange("dateTo", draftDateTo);
    onChange("datePreset", "custom");
    onPresetSelect?.();
  }

  return (
    <>
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
                aria-label={value === "month_to_date" || value === "year_to_date" ? `${option.label}: ${formatRangeLabel(value)}` : undefined}
                title={value === "month_to_date" || value === "year_to_date" ? formatRangeLabel(value) : undefined}
                onClick={() => {
                  onChange("datePreset", option.value);
                  onPresetSelect?.();
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ))}

      <div className="tour-filter__relative-grid">
        <RelativeDayPreset
          active={filters.datePreset === "last_n_days"}
          label="Last"
          value={filters.lastDays}
          onSelect={() => onChange("datePreset", "last_n_days")}
          onDaysChange={(value) => {
            onChange("datePreset", "last_n_days");
            onChange("lastDays", value);
          }}
        />
        <RelativeDayPreset
          active={filters.datePreset === "next_n_days"}
          label="Next"
          value={filters.nextDays}
          onSelect={() => onChange("datePreset", "next_n_days")}
          onDaysChange={(value) => {
            onChange("datePreset", "next_n_days");
            onChange("nextDays", value);
          }}
        />
      </div>

      <div className="tour-filter__range">
        <label>
          <small>From</small>
          <input
            aria-label="Start date"
            max={draftDateTo || "2030-12-31"}
            min="2020-01-01"
            type="date"
            value={draftDateFrom}
            onChange={(event) => {
              setDraftDateFrom(event.target.value);
              setRangeError("");
            }}
          />
        </label>
        <label>
          <small>To</small>
          <input
            aria-label="End date"
            max="2030-12-31"
            min={draftDateFrom || "2020-01-01"}
            type="date"
            value={draftDateTo}
            onChange={(event) => {
              setDraftDateTo(event.target.value);
              setRangeError("");
            }}
          />
        </label>
        {rangeError && <p className="tour-filter__range-error" role="alert">{rangeError}</p>}
        <button className="tour-filter__range-apply" type="button" onClick={applyCustomRange}>
          Apply
        </button>
      </div>
    </>
  );
}

function FilterShell({ children, icon: Icon, isMobileActive = false, isOpen, label, name, onToggle, summary }) {
  return (
    <div
      className={[
        "tour-filter",
        `tour-filter--${name}`,
        isOpen ? "tour-filter--open" : "",
        isMobileActive ? "tour-filter--mobile-active" : "",
      ].filter(Boolean).join(" ")}
    >
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

function LockedFilterShell({ icon: Icon, label, name, note, onNotice, summary }) {
  return (
    <div className={`tour-filter tour-filter--${name} tour-filter--locked`}>
      <button
        className="tour-filter__summary"
        type="button"
        aria-label={`${label}: ${summary}`}
        title={note || `${label}: ${summary}`}
        onClick={() => {
          if (note && onNotice) {
            onNotice(note);
          }
        }}
      >
        <Icon aria-hidden="true" />
        <span>
          <small>{label}</small>
          <strong>{summary}</strong>
        </span>
      </button>
    </div>
  );
}

function AssignedLocationDisplay({ locationName, onNotice }) {
  const message = `Staff accounts are limited to their assigned location${locationName ? `: ${locationName}` : ""}. Admins and super admins can filter across locations.`;

  return (
    <button
      className="tour-filter-assigned-location"
      type="button"
      title={message}
      onClick={() => onNotice(message)}
    >
      <MapPin aria-hidden="true" />
      <div>
        <span>Assigned location</span>
        <strong>{locationName || "No location assigned"}</strong>
      </div>
    </button>
  );
}

function MultiFilter({
  disabled,
  fallback,
  icon,
  isMobileActive,
  isOpen,
  label,
  name,
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
      isMobileActive={isMobileActive}
      isOpen={isOpen}
      label={label}
      name={name}
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

function DateFilter({ filters, isMobileActive, isOpen, onChange, onToggle }) {
  return (
    <FilterShell
      icon={CalendarDays}
      isMobileActive={isMobileActive}
      isOpen={isOpen}
      label="Date"
      name="date"
      onToggle={onToggle}
      summary={getDateSummary(filters)}
    >
      <div className="tour-filter__menu tour-filter__menu--date">
        <DateOptionsContent filters={filters} onChange={onChange} onPresetSelect={onToggle} />
      </div>
    </FilterShell>
  );
}

function TourFilterControls({
  costBasis,
  filters,
  leadSources,
  locations,
  staff = [],
  onChange,
  onCostBasisChange,
  onSortToggle,
  searchPlaceholder = "Search family name",
  showCostBasis = false,
  showCategory = false,
  showDate = true,
  showLeadSource = true,
  showSearch = true,
  showStaff = false,
  showSort = false,
  showStatus = true,
  sortDirection = "asc",
  staffLocationLabel = "",
  staffLocationOnly = false,
  lockDate = false,
  defaultDatePresetValue = defaultDatePreset,
}) {
  const [openFilter, setOpenFilter] = useState("");
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [mobileActiveFilter, setMobileActiveFilter] = useState("");
  const [notice, setNotice] = useState("");
  const filtersRef = useRef(null);
  const filterClassNames = [
    "tour-filters",
    isMobilePanelOpen ? "tour-filters--mobile-open" : "",
    !showSearch ? "tour-filters--no-search" : "",
    !showLeadSource ? "tour-filters--no-lead-source" : "",
    !showStatus ? "tour-filters--no-status" : "",
    showCostBasis ? "tour-filters--with-cost" : "",
    showCategory ? "tour-filters--with-category" : "",
    showSort ? "tour-filters--with-sort" : "",
    lockDate ? "tour-filters--locked-date" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: toTitleCaseWords(location.location_name),
  }));
  const leadSourceOptions = leadSources.map((source) => ({
    value: source.id,
    label: toTitleCaseWords(source.source_name),
  }));
  const staffOptions = staff.map((person) => ({
    value: person.id,
    label: toTitleCaseWords(person.name || person.full_name || person.email || "Staff"),
  }));
  const locationSummary = getSummary(
    filters.locations,
    locationOptions,
    staffLocationOnly
      ? toTitleCaseWords(staffLocationLabel) || locationOptions[0]?.label || "Assigned location"
      : "All locations",
  );
  const lockedDateNote =
    "Home always shows today's booked tours and yesterday's no-shows. Go to Tours to view other dates.";
  const staffLocationDisplay = toTitleCaseWords(staffLocationLabel);
  const staffLocationNote = `Staff accounts are limited to their assigned location${staffLocationDisplay ? `: ${staffLocationDisplay}` : ""}. Admins and super admins can filter across locations.`;
  const mobileFilterOptions = [
    ...(showSort ? [{
      value: "sort",
      label: "Sort",
      summary: sortDirection === "asc" ? "Earliest first" : "Latest first",
      icon: ArrowDownUp,
      action: onSortToggle,
    }] : []),
    ...(showDate ? [{
      value: "date",
      label: "Date",
      summary: lockDate ? "Default: Today" : getDateSummary(filters),
      icon: CalendarDays,
      locked: lockDate,
      note: lockedDateNote,
    }] : []),
    {
      value: "locations",
      label: staffLocationOnly ? "Assigned location" : "Location",
      summary: locationSummary,
      icon: MapPin,
      locked: staffLocationOnly,
      note: staffLocationOnly ? staffLocationNote : "",
    },
    ...(showStaff ? [{
      value: "staff",
      label: "Staff",
      summary: getSummary(filters.staff || [], staffOptions, "All staff"),
      icon: UsersRound,
    }] : []),
    ...(showLeadSource ? [{
      value: "leadSources",
      label: "Lead source",
      summary: getSummary(filters.leadSources, leadSourceOptions, "All"),
      icon: RadioTower,
    }] : []),
    ...(showStatus ? [{
      value: "statuses",
      label: "Status",
      summary: getSummary(filters.statuses, statusOptions, "All"),
      icon: CircleDot,
    }] : []),
    ...(showCategory ? [{
      value: "categories",
      label: "Category",
      summary: getSummary(filters.categories || [], categoryOptions, "All"),
      icon: SlidersHorizontal,
    }] : []),
    ...(showCostBasis ? [{
      value: "cost",
      label: "Cost basis",
      summary: costBasis || "Optional",
      icon: DollarSign,
    }] : []),
  ];

  useEffect(() => {
    function handlePointerDown(event) {
      if (!filtersRef.current?.contains(event.target)) {
        setOpenFilter("");
        setIsMobilePanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function toggleFilter(name) {
    setOpenFilter((currentFilter) => (currentFilter === name ? "" : name));
    setNotice("");
  }

  function closeMobilePanel() {
    setIsMobilePanelOpen(false);
    setOpenFilter("");
    setMobileActiveFilter("");
  }

  function selectMobileFilter(option) {
    if (option.action) {
      option.action();
      return;
    }
    if (option.locked) {
      if (option.note) {
        setNotice(option.note);
      }
      setMobileActiveFilter("");
      setOpenFilter("");
      return;
    }
    setMobileActiveFilter((currentFilter) => (currentFilter === option.value ? "" : option.value));
    setOpenFilter("");
  }

  function clearAllFilters() {
    onChange("datePreset", lockDate ? "today" : defaultDatePresetValue);
    onChange("dateFrom", "");
    onChange("dateTo", "");
    onChange("lastDays", 7);
    onChange("nextDays", 7);
    onChange("month", currentMonthValue());
    onChange("year", currentYearValue());
    if (!staffLocationOnly) {
      onChange("locations", []);
    }
    onChange("leadSources", []);
    onChange("staff", []);
    onChange("statuses", []);
    onChange("categories", []);
    onChange("search", "");
    if (showCostBasis && onCostBasisChange) {
      onCostBasisChange("");
    }
    setMobileActiveFilter("");
    setOpenFilter("");
  }

  function renderMobileDateOptions() {
    if (lockDate) {
      return null;
    }
    return (
      <div className="tour-filters__mobile-expanded">
        <DateOptionsContent filters={filters} onChange={onChange} onPresetSelect={() => setMobileActiveFilter("")} />
      </div>
    );
  }

  function renderMobileMultiOptions({ disabled = false, label, options, values, onValuesChange }) {
    return (
      <div className="tour-filters__mobile-expanded">
        <div className="tour-filter__toolbar">
          <button
            type="button"
            aria-label={`Select all ${label}`}
            disabled={disabled}
            onClick={() => onValuesChange(options.map((option) => String(option.value)))}
          >
            <CheckCheck aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Clear ${label}`}
            disabled={disabled || values.length === 0}
            onClick={() => onValuesChange([])}
          >
            <Eraser aria-hidden="true" />
          </button>
        </div>
        {options.map((option) => {
          const value = String(option.value);
          return (
            <label className="tour-filter__option" key={option.value}>
              <input
                type="checkbox"
                checked={values.includes(value)}
                disabled={disabled}
                onChange={() => {
                  if (values.includes(value)) {
                    onValuesChange(values.filter((item) => item !== value));
                    return;
                  }
                  onValuesChange([...values, value]);
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  function renderMobileActiveOptions(name) {
    if (name === "date") {
      return renderMobileDateOptions();
    }
    if (name === "locations") {
      return renderMobileMultiOptions({
        disabled: staffLocationOnly,
        label: "Location",
        options: locationOptions,
        values: filters.locations,
        onValuesChange: (values) => onChange("locations", values),
      });
    }
    if (name === "leadSources") {
      return renderMobileMultiOptions({
        label: "Lead source",
        options: leadSourceOptions,
        values: filters.leadSources,
        onValuesChange: (values) => onChange("leadSources", values),
      });
    }
    if (name === "staff") {
      return renderMobileMultiOptions({
        label: "Staff",
        options: staffOptions,
        values: filters.staff || [],
        onValuesChange: (values) => onChange("staff", values),
      });
    }
    if (name === "statuses") {
      return renderMobileMultiOptions({
        label: "Status",
        options: statusOptions,
        values: filters.statuses,
        onValuesChange: (values) => onChange("statuses", values),
      });
    }
    if (name === "categories") {
      return renderMobileMultiOptions({
        label: "Category",
        options: categoryOptions,
        values: filters.categories || [],
        onValuesChange: (values) => onChange("categories", values),
      });
    }
    if (name === "cost") {
      return (
        <div className="tour-filters__mobile-expanded">
          <label className="tour-filter--cost tour-filter--cost-mobile">
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
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={filterClassNames}
      ref={filtersRef}
      aria-label="Tour filters"
    >
      <div className="tour-filters__mobile-bar">
        <button
          className="tour-filters__mobile-trigger"
          type="button"
          aria-expanded={isMobilePanelOpen}
          aria-label={isMobilePanelOpen ? "Close filters" : "Open filters"}
          onClick={() => {
            setIsMobilePanelOpen((currentValue) => {
              const nextValue = !currentValue;
              if (nextValue && !showDate && mobileActiveFilter === "date") {
                setMobileActiveFilter("");
              }
              if (!nextValue) {
                setOpenFilter("");
                setMobileActiveFilter("");
              }
              return nextValue;
            });
          }}
        >
          <SlidersHorizontal aria-hidden="true" />
        </button>

        {showSearch && (
          <label className="tour-filters__mobile-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              value={filters.search}
              onChange={(event) => onChange("search", event.target.value)}
            />
          </label>
        )}
      </div>

      {notice && (
        <p className="tour-filters__notice" role="status">
          {notice}
        </p>
      )}

      <div className="tour-filters__mobile-panel" aria-label="Available filters">
        <div className="tour-filters__mobile-list">
          {mobileFilterOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div className="tour-filters__mobile-group" key={option.value}>
                <button
                  className="tour-filters__mobile-option"
                  type="button"
                  aria-pressed={mobileActiveFilter === option.value}
                  aria-disabled={option.locked ? "true" : undefined}
                  title={option.note || undefined}
                  onClick={() => selectMobileFilter(option)}
                >
                  <Icon aria-hidden="true" />
                  <span>{option.label}</span>
                  <em>{option.summary}</em>
                </button>
                {mobileActiveFilter === option.value && renderMobileActiveOptions(option.value)}
              </div>
            );
          })}
        </div>
      </div>

      {showSort && (
        <button
          className="tour-filters__sort"
          type="button"
          aria-label={
            sortDirection === "asc"
              ? "Sort earliest to latest"
              : "Sort latest to earliest"
          }
          title={
            sortDirection === "asc"
              ? "Earliest to latest"
              : "Latest to earliest"
          }
          onClick={onSortToggle}
        >
          <ArrowDownUp aria-hidden="true" />
          <span>
            <small>Sort</small>
            <strong>{sortDirection === "asc" ? "Earliest first" : "Latest first"}</strong>
          </span>
        </button>
      )}

      {showDate && lockDate && (
        <LockedFilterShell
          icon={CalendarDays}
          label="Date"
          name="date"
          note={lockedDateNote}
          onNotice={setNotice}
          summary="Default: Today"
        />
      )}

      {showDate && !lockDate && (
        <DateFilter
          filters={filters}
          isMobileActive={false}
          isOpen={openFilter === "date"}
          onChange={onChange}
          onToggle={() => toggleFilter("date")}
        />
      )}

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

      {staffLocationOnly ? (
        <AssignedLocationDisplay
          locationName={staffLocationLabel || locationSummary}
          onNotice={setNotice}
        />
      ) : (
        <MultiFilter
          fallback="All locations"
          icon={MapPin}
          isMobileActive={mobileActiveFilter === "locations"}
          isOpen={openFilter === "locations"}
          label="Location"
          name="locations"
          onChange={(values) => onChange("locations", values)}
          onToggle={() => toggleFilter("locations")}
          options={locationOptions}
          values={filters.locations}
        />
      )}

      {showLeadSource && (
        <MultiFilter
          fallback="All sources"
          icon={RadioTower}
          isMobileActive={mobileActiveFilter === "leadSources"}
          isOpen={openFilter === "leadSources"}
          label="Lead source"
          name="leadSources"
          onChange={(values) => onChange("leadSources", values)}
          onToggle={() => toggleFilter("leadSources")}
          options={leadSourceOptions}
          values={filters.leadSources}
        />
      )}

      {showStaff && (
        <MultiFilter
          fallback="All staff"
          icon={UsersRound}
          isMobileActive={mobileActiveFilter === "staff"}
          isOpen={openFilter === "staff"}
          label="Staff"
          name="staff"
          onChange={(values) => onChange("staff", values)}
          onToggle={() => toggleFilter("staff")}
          options={staffOptions}
          values={filters.staff || []}
        />
      )}

      {showStatus && (
        <MultiFilter
          fallback="All statuses"
          icon={CircleDot}
          isMobileActive={mobileActiveFilter === "statuses"}
          isOpen={openFilter === "statuses"}
          label="Status"
          name="statuses"
          onChange={(values) => onChange("statuses", values)}
          onToggle={() => toggleFilter("statuses")}
          options={statusOptions}
          values={filters.statuses}
        />
      )}

      {showCategory && (
        <MultiFilter
          fallback="All categories"
          icon={SlidersHorizontal}
          isMobileActive={mobileActiveFilter === "categories"}
          isOpen={openFilter === "categories"}
          label="Category"
          name="categories"
          onChange={(values) => onChange("categories", values)}
          onToggle={() => toggleFilter("categories")}
          options={categoryOptions}
          values={filters.categories || []}
        />
      )}

      {showCostBasis && (
        <label className={`tour-filter tour-filter--cost ${mobileActiveFilter === "cost" ? "tour-filter--mobile-active" : ""}`}>
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

      <div className="tour-filters__mobile-actions">
        <button
          className="tour-filters__mobile-clear"
          type="button"
          onClick={clearAllFilters}
        >
          Clear all
        </button>
        <button
          className="tour-filters__mobile-done"
          type="button"
          onClick={closeMobilePanel}
        >
          Apply filters
        </button>
      </div>
    </div>
  );
}

export default TourFilterControls;
