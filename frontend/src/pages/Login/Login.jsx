import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import useAuth from "../../features/auth/useAuth";
import useUnsavedChangesPrompt from "../../hooks/useUnsavedChangesPrompt";

import BrandSection from "../../components/auth/BrandSection";
import ProductSection from "../../components/auth/ProductSection";
import HeroSection from "../../components/auth/HeroSection";
import LoginCard from "../../components/auth/LoginCard";
import loginBackgroundVideo from "../../assets/brand/rss-login-background.mp4";

import "./Login.css";

function Login() {
  const { isAuthenticated, login } = useAuth();

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const backgroundVideoRef = useRef(null);

  const destination = "/home";
  const hasUnsavedLogin = Boolean(email || password);

  useUnsavedChangesPrompt(hasUnsavedLogin && !isSubmitting && !isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, { replace: true });
    }
  }, [destination, isAuthenticated, navigate]);

  useEffect(() => {
    const video = backgroundVideoRef.current;

    if (!video) {
      return undefined;
    }

    const startPlayback = () => {
      video.play().catch(() => {
        // Browser autoplay policies can still pause video; the static poster frame remains.
      });
    };

    startPlayback();
    video.addEventListener("canplay", startPlayback);

    return () => {
      video.removeEventListener("canplay", startPlayback);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    setIsSubmitting(true);

    try {
      await login({
        email,
        password,
      });

      navigate(destination, { replace: true });
    } catch (requestError) {
      const message =
        requestError.response?.data?.non_field_errors?.[0];

      setError(message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <video
        ref={backgroundVideoRef}
        className="auth-background-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src={loginBackgroundVideo} type="video/mp4" />
      </video>

      <div className="auth-background-overlay" aria-hidden="true" />

      <BrandSection />

      <section className="auth-left-panel">

        <ProductSection />

        <HeroSection />

      </section>

      <section className="auth-right-panel">

        <LoginCard
          id="staff-login-card"
          email={email}
          password={password}
          error={error}
          isSubmitting={isSubmitting}
          onEmailChange={(e) => setEmail(e.target.value)}
          onPasswordChange={(e) => setPassword(e.target.value)}
          onSubmit={handleSubmit}
        />

      </section>

    </main>
  );
}

export default Login;
