import logo from "../../../assets/login/logo.png";
import "./TopBanner.css";

function TopBanner() {
  return (
    <header className="top-banner">
      <div className="top-banner__brand" aria-label="Ready Set STEM">
        <img className="top-banner__logo" src={logo} alt="" aria-hidden="true" />
        <span className="top-banner__name">Ready Set STEM</span>
      </div>
    </header>
  );
}

export default TopBanner;
