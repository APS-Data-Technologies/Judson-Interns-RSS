import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import useAuth from "../../features/auth/useAuth";

import BrandSection from "../../components/auth/BrandSection";
import ProductSection from "../../components/auth/ProductSection";
import HeroSection from "../../components/auth/HeroSection";
import LoginCard from "../../components/auth/LoginCard";

import "./Login.css";

function Login() {
  const { isAuthenticated, login } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const destination = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, { replace: true });
    }
  }, [destination, isAuthenticated, navigate]);

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

      <section className="auth-left-panel">

        <BrandSection />

        <ProductSection />

        <HeroSection />

      </section>

      <section className="auth-right-panel">

        <LoginCard
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