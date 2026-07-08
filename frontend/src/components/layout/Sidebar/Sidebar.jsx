import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, CalendarCheck, Home, ListChecks, LogOut, Settings } from "lucide-react";
import useAuth from "../../../features/auth/useAuth";
import "./Sidebar.css";

const navItems = [
  { label: "Home", to: "/home", icon: Home },
  { label: "Tours", to: "/tours", icon: CalendarCheck },
  { label: "Pipeline", to: "/pipeline", icon: ListChecks },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
];

function Sidebar() {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <aside className="app-sidebar" aria-label="Application navigation">
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/home"}
              className={({ isActive }) => {
                const isSettingsArea =
                  item.to === "/settings" &&
                  location.pathname.startsWith("/admin");
                return `sidebar-nav-item ${isActive || isSettingsArea ? "active" : ""}`;
              }}
            >
              <span className="sidebar-nav-icon-wrap">
                <Icon className="sidebar-nav-icon" aria-hidden="true" />
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <button className="sidebar-logout" type="button" onClick={logout}>
        <span className="sidebar-nav-icon-wrap">
          <LogOut className="sidebar-nav-icon" aria-hidden="true" />
        </span>
        <span className="sidebar-nav-label">Logout</span>
      </button>
    </aside>
  );
}

export default Sidebar;
