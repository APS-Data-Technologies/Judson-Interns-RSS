import mobileHero from "../../assets/login/Mobile_Hero.png";
import tabletHero from "../../assets/login/Tablet_Hero.png";
import desktopHero from "../../assets/login/Desktop_Hero.png";

function HeroSection() {
  return (
    <section className="auth-hero-section" aria-hidden="true">
      <picture>
        <source media="(min-width: 1100px)" srcSet={desktopHero} />
        <source media="(min-width: 768px)" srcSet={tabletHero} />
        <img src={mobileHero} alt="" className="auth-hero-image" />
      </picture>
    </section>
  );
}

export default HeroSection;