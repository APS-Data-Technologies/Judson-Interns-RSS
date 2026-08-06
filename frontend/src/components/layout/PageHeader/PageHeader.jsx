import "./PageHeader.css";

export default function PageHeader({
  title,
  subtitle,
  action,
  className = "",
}) {
  const headerClass = ["rss-page-header", className].filter(Boolean).join(" ");

  return (
    <header className={headerClass}>
      <div className="rss-page-header__content">
        <h1 className="rss-page-header__title">{title}</h1>

        {subtitle && (
          <p className="rss-page-header__subtitle">{subtitle}</p>
        )}
      </div>

      {action && (
        <div className="rss-page-header__actions">{action}</div>
      )}
    </header>
  );
}