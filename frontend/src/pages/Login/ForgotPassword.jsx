import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

import BrandSection from "../../components/auth/BrandSection";
import ProductSection from "../../components/auth/ProductSection";
import HeroSection from "../../components/auth/HeroSection";
import { Input } from "../../components/form";
import { Button, Card } from "../../components/ui";
import { requestPasswordReset } from "../../features/auth/authApi";
import brandLockup from "../../assets/brand/rss-logo-horizontal.png";
import loginBackgroundVideo from "../../assets/brand/rss-login-background.mp4";

import "./PasswordReset.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setIsSubmitted(true);
    } catch (requestError) {
      const message = requestError.response?.data?.email?.[0];
      setError(message || "We could not process your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <video className="auth-background-video" autoPlay muted loop playsInline preload="auto" aria-hidden="true">
        <source src={loginBackgroundVideo} type="video/mp4" />
      </video>
      <div className="auth-background-overlay" aria-hidden="true" />
      <BrandSection />
      <section className="auth-left-panel"><ProductSection /><HeroSection /></section>
      <section className="auth-right-panel">
        <section className="auth-login-section" aria-labelledby="forgot-password-title">
          <Card padding="lg" shadow="md" className="auth-login-card password-reset-card">
            <div className="auth-login-form">
              <img className="auth-login-logo" src={brandLockup} alt="Ready Set STEM" />
              <div className="auth-login-heading">
                <span>Account security</span>
                <h2 id="forgot-password-title">Reset password</h2>
                <p>Enter your work email and we’ll send a secure, one-time reset link.</p>
              </div>
              {isSubmitted ? (
                <div className="auth-success" role="status">
                  If an active account matches that email address, a reset link is on its way. Check your inbox and spam folder.
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <Input
                    id="reset-email"
                    type="email"
                    label="Work email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoFocus
                    leftIcon={<Mail size={20} />}
                    error={error}
                  />
                  <Button type="submit" fullWidth disabled={isSubmitting}>
                    {isSubmitting ? "Sending link..." : "Send reset link"}
                  </Button>
                </form>
              )}
              <Link className="auth-back-link" to="/login">Back to sign in</Link>
            </div>
          </Card>
        </section>
      </section>
    </main>
  );
}

export default ForgotPassword;
