import brandLockup from "../../../assets/brand/rss-logo-horizontal.png";
import "./TopBanner.css";

function TopBanner() {
  return (
    <header className="top-banner">
      <div className="top-banner__brand" aria-label="Ready Set STEM">
        <img className="top-banner__logo" src={brandLockup} alt="Ready Set STEM" />
      </div>
    </header>
  );
}

export default TopBanner;
