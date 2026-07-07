import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppShell } from "../../components/layout";
import useAuth from "./useAuth";

const routeTitles = {
  "/": "Staff Home",
  "/tours": "Tours",
  "/pipeline": "Pipeline",
  "/analytics": "Analytics",
  "/admin": "Admin",
  "/account": "Account",
};

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="route-loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <AppShell title={routeTitles[location.pathname] || "Ready Set STEM"}>
      <Outlet />
    </AppShell>
  );
}

export default ProtectedRoute;
