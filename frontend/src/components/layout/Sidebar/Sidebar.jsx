import { NavLink } from "react-router-dom";
import { BarChart3, CalendarCheck, Home, ListChecks, LogOut, Settings } from "lucide-react";
import useAuth from "../../../features/auth/useAuth";
import "./Sidebar.css";

const navItems = [
  { label: "Home", to: "/", icon: Home },
  { label: "Tours", to: "/tours", icon: CalendarCheck },
  { label: "Pipeline", to: "/pipeline", icon: ListChecks },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Settings", to: "/account", icon: Settings },
];

function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="app-sidebar" aria-label="Application navigation">
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon className="sidebar-nav-icon" aria-hidden="true" />
              <span className="sidebar-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <button className="sidebar-logout" type="button" onClick={logout}>
        <LogOut className="sidebar-nav-icon" aria-hidden="true" />
        <span className="sidebar-nav-label">Logout</span>
      </button>
    </aside>
  );
}

export default Sidebar;
