import { NavLink } from "react-router-dom";
import useAuth from "../../../features/auth/useAuth";
import "./BottomNavigation.css";

function BottomNavigation() {
  const { user } = useAuth();
  const canAccessAdmin = user.role === "super_admin" || user.role === "admin";

  return (
    <nav className={`bottom-nav ${canAccessAdmin ? "has-admin" : ""}`}>
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/tours">Tours</NavLink>
      <NavLink to="/pipeline">Pipeline</NavLink>
      <NavLink to="/analytics">Analytics</NavLink>
      {canAccessAdmin && <NavLink to="/admin">Admin</NavLink>}
    </nav>
  );
}

export default BottomNavigation;
