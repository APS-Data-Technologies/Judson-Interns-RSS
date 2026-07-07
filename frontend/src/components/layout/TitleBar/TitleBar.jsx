import "./TitleBar.css";

function TitleBar({ title }) {
  return (
    <section className="title-bar">
      <h1>{title}</h1>
    </section>
  );
}

export default TitleBar;
