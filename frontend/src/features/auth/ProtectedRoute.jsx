import { Navigate, Outlet, useLocation } from "react-router-dom";
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
      : routeTitle || dynamicTitle || "Ready Set STEM";
  const showBack = !primaryRoutes.has(location.pathname);

  return (
    <AppShell title={pageTitle} showBack={showBack}>
      <Outlet />
    </AppShell>
  );
}

export default ProtectedRoute;
