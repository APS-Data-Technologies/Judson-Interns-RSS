import brandLockup from "../../assets/brand/rss-logo-horizontal.png";

function BrandSection() {
  return (
    <section className="auth-brand-section">

      <div className="brand-lockup">

        <img
          src={brandLockup}
          alt="Ready Set STEM"
          className="auth-brand-logo"
        />

      </div>

    </section>
  );
}

export default BrandSection;
