import { Eye, Lock, Mail } from "lucide-react";
import { Button, Card } from "../ui";
import { Input } from "../form";

function LoginCard({
  email,
  password,
  error,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  return (
    <section className="auth-login-section">
      <Card padding="lg" shadow="md" className="auth-login-card">
        <form className="auth-login-form" onSubmit={onSubmit}>
          <h2>Welcome</h2>

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
            type="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={onPasswordChange}
            required
            leftIcon={<Lock size={20} />}
            rightElement={<Eye size={20} />}
          />

          <a className="auth-forgot-link" href="#forgot-password">
            Forgot password?
          </a>

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