import { NavLink } from "react-router-dom";
import "./BottomNavigation.css";

function BottomNavigation() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/tours">Tours</NavLink>
      <NavLink to="/pipeline">Pipeline</NavLink>
      <NavLink to="/analytics">Analytics</NavLink>
      <NavLink to="/admin">Admin</NavLink>
    </nav>
  );
}

export default BottomNavigation;