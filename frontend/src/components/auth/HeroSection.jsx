import { CalendarCheck, ChartNoAxesColumnIncreasing, Home, LayoutDashboard, MoveRight } from "lucide-react";

const staffHighlights = [
  {
    icon: Home,
    label: "Home",
    value: "Focus",
    text: "Start your day with schedule, follow-ups and updates.",
  },
  {
    icon: CalendarCheck,
    label: "Tours",
    value: "Manage",
    text: "View, Edit and Update tours and see tour history.",
  },
  {
    icon: MoveRight,
    label: "Pipeline",
    value: "Progress",
    text: "Move families through each stage with clear, trackable actions.",
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    label: "Analytics",
    value: "Insights",
    text: "Monitor trends, measure outcomes, and identify opportunities for improvement.",
  },
];

function HeroSection() {
  return (
    <section className="auth-hero-section" aria-label="Staff workspace overview">
      <div className="auth-operations-panel">
        <div className="auth-operations-copy">
          <span className="auth-workspace-badge">
            <LayoutDashboard aria-hidden="true" size={18} />
            WORKSPACE
          </span>
          <h2>
            Your daily hub for managing tours, families, and staying on top of
            enrollment activities.
          </h2>
        </div>

        <div className="auth-operations-grid" aria-label="Workspace capabilities">
          {staffHighlights.map(({ icon: Icon, label, value, text }) => (
            <article className="auth-operations-card" key={label}>
              <div className="auth-operations-card__top">
                <span className="auth-operations-icon">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <div>
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
              </div>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
