import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button, Card } from "../ui";
import { Input } from "../form";
import brandLockup from "../../assets/brand/rss-logo-horizontal.png";

function LoginCard({
  id,
  email,
  password,
  error,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="auth-login-section" id={id}>
      <Card padding="lg" shadow="md" className="auth-login-card">
        <form className="auth-login-form" onSubmit={onSubmit}>
          <img className="auth-login-logo" src={brandLockup} alt="Ready Set STEM" />

          <div className="auth-login-heading">
            <span>Staff Sign In</span>
            <h2>Welcome !</h2>
            <p>Sign in to access your workspace.</p>
          </div>

          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={onEmailChange}
            required
            autoFocus
            leftIcon={<Mail size={20} />}
          />

          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={onPasswordChange}
            required
            leftIcon={<Lock size={20} />}
            rightElement={
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            }
          />

          <Link className="auth-forgot-link" to="/forgot-password">
            Forgot password?
          </Link>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Log in"}
          </Button>
        </form>
      </Card>
    </section>
  );
}

export default LoginCard;
