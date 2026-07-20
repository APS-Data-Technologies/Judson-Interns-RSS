import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout";
import { toTitleCaseWords } from "../../utils/displayText";
import useAuth from "./useAuth";

const routeTitles = {
  "/home": "Home",
  "/tours": "Tours",
  "/tours/new": "New Tour",
  "/pipeline": "Pipeline",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/admin": "Admin",
  "/admin/users": "Manage Users",
  "/admin/users/new": "Add User",
  "/admin/locations": "Manage Locations",
  "/admin/locations/new": "Add Location",
  "/admin/lead-sources": "Manage Lead Sources",
  "/admin/lead-sources/new": "Add Lead Source",
};

const primaryRoutes = new Set([
  "/home",
  "/tours",
  "/pipeline",
  "/analytics",
  "/settings",
  "/admin",
  "/admin/users",
  "/admin/locations",
  "/admin/lead-sources",
]);

const analyticsViews = [
  { value: "overview", label: "Overview", path: "/analytics/overview" },
  { value: "cohort", label: "Cohort Analysis", path: "/analytics/cohort" },
];

function AnalyticsTitlePicker({ pathname }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const activeView =
    analyticsViews.find((view) => pathname === view.path) || analyticsViews[0];

  function handleSelect(view) {
    setIsOpen(false);
    if (view.path !== pathname) {
      navigate(view.path);
    }
  }

  return (
    <span
      className="analytics-title-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <span className="analytics-title-picker__prefix">Analytics:</span>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="analytics-title-picker__trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{activeView.label}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {isOpen && (
        <span className="analytics-title-picker__menu" role="menu">
          {analyticsViews.map((view) => (
            <button
              className={view.value === activeView.value ? "is-active" : ""}
              key={view.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(view)}
              role="menuitem"
              type="button"
            >
              {view.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="route-loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const firstName = toTitleCaseWords(user?.first_name || user?.email?.split("@")[0] || "there");
  const isAnalyticsRoute = location.pathname.startsWith("/analytics");
  const routeTitle = routeTitles[location.pathname];
  const dynamicTitle = routeTitle
    ? null
    : location.pathname.match(/^\/tours\/[^/]+\/edit$/)
    ? "Edit Tour"
    : location.pathname.match(/^\/tours\/[^/]+$/)
      ? "Tour Details"
      : null;
  const pageTitle =
    location.pathname === "/home"
      ? `Hello ${firstName}`
      : isAnalyticsRoute
        ? <AnalyticsTitlePicker pathname={location.pathname} />
      : routeTitle || dynamicTitle || "Ready Set STEM";
  const showBack = !primaryRoutes.has(location.pathname) && !isAnalyticsRoute;

  return (
    <AppShell title={pageTitle} showBack={showBack}>
      <Outlet />
    </AppShell>
  );
}

export default ProtectedRoute;
