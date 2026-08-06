import "./Section.css";

export default function Section({
  title,
  subtitle,
  action,
  children,
  className = "",
}) {
  const sectionClass = ["rss-section", className].filter(Boolean).join(" ");

  return (
    <section className={sectionClass}>
      {(title || subtitle || action) && (
        <div className="rss-section__header">
          <div>
            {title && <h2 className="rss-section__title">{title}</h2>}
            {subtitle && <p className="rss-section__subtitle">{subtitle}</p>}
          </div>

          {action && <div className="rss-section__action">{action}</div>}
        </div>
      )}

      <div className="rss-section__content">{children}</div>
    </section>
  );
}