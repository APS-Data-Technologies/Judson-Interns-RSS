import "./Analytics.css";

function AnalyticsPlaceholder({ title }) {
  return (
    <section className="analytics-page" aria-label={title}>
      <section className="analytics-empty-page">
        <h2>{title}</h2>
        <p>This analytics page is ready for its detailed reporting content.</p>
      </section>
    </section>
  );
}

export default AnalyticsPlaceholder;
