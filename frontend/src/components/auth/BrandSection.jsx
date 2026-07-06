import logo from "../../assets/login/logo.png";

function BrandSection() {
  return (
    <section className="auth-brand-section">

      <div className="brand-lockup">

        <img
          src={logo}
          alt="Ready Set STEM"
          className="auth-brand-logo"
        />

        <div className="auth-brand-text">
          Ready Set STEM
        </div>

      </div>

    </section>
  );
}

export default BrandSection;