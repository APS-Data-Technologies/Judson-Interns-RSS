import { ArrowLeft } from "lucide-react";
import "./TitleBar.css";

function TitleBar({ onBack, showBack = false, title }) {
  return (
    <section className="title-bar">
      {showBack ? (
        <button className="title-bar__back" type="button" onClick={onBack} aria-label="Go back">
          <ArrowLeft aria-hidden="true" />
        </button>
      ) : (
        <span className="title-bar__back-spacer" aria-hidden="true" />
      )}
      <h1>{title}</h1>
    </section>
  );
}

export default TitleBar;
