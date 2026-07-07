import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, CalendarCheck, Home, ListChecks, Settings } from "lucide-react";
import "./BottomNavigation.css";

const navItems = [
  { label: "Home", to: "/home", icon: Home },
  { label: "Tours", to: "/tours", icon: CalendarCheck },
  { label: "Pipeline", to: "/pipeline", icon: ListChecks },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
];

function BottomNavigation() {
  const location = useLocation();

  return (
    <nav className="bottom-navigation" aria-label="Bottom navigation">
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
              return `bottom-navigation__item ${isActive || isSettingsArea ? "active" : ""}`;
            }}
          >
            <Icon className="bottom-navigation__icon" aria-hidden="true" />
            <span className="bottom-navigation__label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default BottomNavigation;
