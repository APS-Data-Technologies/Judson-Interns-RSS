import { NavLink } from "react-router-dom";
import { BarChart3, CalendarCheck, Home, ListChecks, Settings } from "lucide-react";
import "./BottomNavigation.css";

const navItems = [
  { label: "Home", to: "/", icon: Home },
  { label: "Tours", to: "/tours", icon: CalendarCheck },
  { label: "Pipeline", to: "/pipeline", icon: ListChecks },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Settings", to: "/account", icon: Settings },
];

function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="Bottom navigation">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `bottom-navigation__item ${isActive ? "active" : ""}`
            }
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
