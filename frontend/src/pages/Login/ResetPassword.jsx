import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";

import BrandSection from "../../components/auth/BrandSection";
import ProductSection from "../../components/auth/ProductSection";
import HeroSection from "../../components/auth/HeroSection";
import { Input } from "../../components/form";
import { Button, Card } from "../../components/ui";
import { confirmPasswordReset } from "../../features/auth/authApi";
import brandLockup from "../../assets/brand/rss-logo-horizontal.png";
import loginBackgroundVideo from "../../assets/brand/rss-login-background.mp4";

import "./PasswordReset.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await confirmPasswordReset({ token, newPassword });
      setIsSubmitted(true);
    } catch (requestError) {
      const data = requestError.response?.data;
      setError(data?.new_password?.[0] || data?.token?.[0] || "We could not reset your password. Please request a new link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const passwordToggle = (
    <button
      type="button"
      className="auth-password-toggle"
      onClick={() => setShowPassword((current) => !current)}
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  );

  return (
    <main className="auth-layout">
      <video className="auth-background-video" autoPlay muted loop playsInline preload="auto" aria-hidden="true">
        <source src={loginBackgroundVideo} type="video/mp4" />
      </video>
      <div className="auth-background-overlay" aria-hidden="true" />
      <BrandSection />
      <section className="auth-left-panel"><ProductSection /><HeroSection /></section>
      <section className="auth-right-panel">
        <section className="auth-login-section" aria-labelledby="new-password-title">
          <Card padding="lg" shadow="md" className="auth-login-card password-reset-card">
            <div className="auth-login-form">
              <img className="auth-login-logo" src={brandLockup} alt="Ready Set STEM" />
              <div className="auth-login-heading">
                <span>Account security</span>
                <h2 id="new-password-title">Choose a new password</h2>
                <p>Use a unique password of at least eight characters.</p>
              </div>
              {isSubmitted ? (
                <div className="auth-success" role="status">
                  Your password has been reset. You can now sign in with your new password.
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    label="New password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    autoFocus
                    leftIcon={<Lock size={20} />}
                    rightElement={passwordToggle}
                  />
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    label="Confirm new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    leftIcon={<Lock size={20} />}
                    rightElement={passwordToggle}
                    error={error}
                  />
                  <Button type="submit" fullWidth disabled={isSubmitting || !token}>
                    {isSubmitting ? "Resetting password..." : "Reset password"}
                  </Button>
                </form>
              )}
              {!token && !isSubmitted && <p className="auth-error" role="alert">This reset link is invalid. Request a new one.</p>}
              <Link className="auth-back-link" to="/login">Back to sign in</Link>
            </div>
          </Card>
        </section>
      </section>
    </main>
  );
}

export default ResetPassword;
