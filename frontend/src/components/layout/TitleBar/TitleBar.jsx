import { ArrowLeft } from "lucide-react";
import "./TitleBar.css";

function TitleBar({ onBack, showBack = false, title }) {
  const TitleElement = typeof title === "string" ? "h1" : "div";

  return (
    <section className="title-bar">
      {showBack ? (
        <button className="title-bar__back" type="button" onClick={onBack} aria-label="Go back">
          <ArrowLeft aria-hidden="true" />
        </button>
      ) : (
        <span className="title-bar__back-spacer" aria-hidden="true" />
      )}
      <TitleElement className="title-bar__title">{title}</TitleElement>
      <span className="title-bar__actions" id="analytics-title-actions" />
    </section>
  );
}

export default TitleBar;
