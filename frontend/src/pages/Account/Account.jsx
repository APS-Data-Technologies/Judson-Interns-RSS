import { useState } from "react";
import useAuth from "../../features/auth/useAuth";
import "./Account.css";

function Account() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (requestError) {
      const data = requestError.response?.data;
      const responseMessage = data?.current_password?.[0] || data?.new_password?.[0];
      setError(responseMessage || "Unable to change password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="account-page">
      <header className="page-heading">
        <h2>Account</h2>
        <p>{user.email}</p>
      </header>

      <dl className="account-details">
        <div><dt>Name</dt><dd>{`${user.first_name} ${user.last_name}`.trim()}</dd></div>
        <div><dt>Role</dt><dd>{user.role.replace("_", " ")}</dd></div>
        {user.location_name && <div><dt>Location</dt><dd>{user.location_name}</dd></div>}
      </dl>

      <form className="password-form" onSubmit={handleSubmit}>
        <h3>Change password</h3>
        <label htmlFor="current-password">Current password</label>
        <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="8" required />
        <label htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="8" required />
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Update password"}</button>
      </form>
    </section>
  );
}

export default Account;
