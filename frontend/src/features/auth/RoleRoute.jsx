import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import useAuth from "./useAuth";

function RoleRoute({ allowedRoles }) {
  const { user } = useAuth();
  const outletContext = useOutletContext();

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet context={outletContext} />;
}

export default RoleRoute;
