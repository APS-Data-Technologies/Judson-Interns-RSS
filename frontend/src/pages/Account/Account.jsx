import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  CircleDollarSign,
  KeyRound,
  LogOut,
  MapPin,
  RadioTower,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import useAuth from "../../features/auth/useAuth";
import useUnsavedChangesPrompt from "../../hooks/useUnsavedChangesPrompt";
import { formatPersonName, toTitleCaseWords } from "../../utils/displayText";
import "./Account.css";

function SettingsPanel({ children, icon: Icon, isOpen, onToggle, title }) {
  return (
    <section className={`settings-panel ${isOpen ? "settings-panel--open" : ""}`}>
      <button className="settings-panel__trigger" type="button" onClick={onToggle}>
        <span className="settings-panel__icon">
          <Icon aria-hidden="true" />
        </span>
        <strong>{title}</strong>
        <ChevronDown aria-hidden="true" />
      </button>
      {isOpen && <div className="settings-panel__body">{children}</div>}
    </section>
  );
}

function Account() {
  const { user, changePassword, logout } = useAuth();
  const [openPanel, setOpenPanel] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasUnsavedPassword = Boolean(currentPassword || newPassword || confirmPassword);
  const canOpenAdmin = ["admin", "super_admin"].includes(user.role);
  const canManageUsers = user.role === "super_admin";
  const displayName = formatPersonName(user.first_name, user.last_name, user.email);

  useUnsavedChangesPrompt(hasUnsavedPassword && !isSubmitting);

  function togglePanel(panelName) {
    setOpenPanel((currentPanel) => (currentPanel === panelName ? "" : panelName));
  }

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
      setMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      const data = requestError.response?.data;
      const responseMessage = data?.current_password?.[0] || data?.new_password?.[0];
      setError(responseMessage || "Unable to change password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="account-page" aria-label="Settings">
      <header className="account-profile">
        <div className="account-profile__avatar" aria-hidden="true">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1>{displayName}</h1>
          <p>{user.role.replace("_", " ")}</p>
        </div>
      </header>

      {user.role === "staff" && (
        <section className="account-location">
          <MapPin aria-hidden="true" />
          <div>
            <span>Assigned location</span>
            <strong>{toTitleCaseWords(user.location_name) || "No location assigned"}</strong>
          </div>
        </section>
      )}

      <SettingsPanel
        icon={KeyRound}
        isOpen={openPanel === "password"}
        onToggle={() => togglePanel("password")}
        title="Update password"
      >
        <form className="password-form" onSubmit={handleSubmit}>
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength="8"
            required
          />
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength="8"
            required
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update password"}
          </button>
        </form>
      </SettingsPanel>

      {canOpenAdmin && (
        <SettingsPanel
          icon={ShieldCheck}
          isOpen={openPanel === "admin"}
          onToggle={() => togglePanel("admin")}
          title="Admin privileges"
        >
          <nav className="settings-admin-links" aria-label="Admin management">
            {canManageUsers && (
              <Link to="/admin/users">
                <UsersRound aria-hidden="true" />
                <span>Manage users</span>
              </Link>
            )}
            <Link to="/admin/locations">
              <Building2 aria-hidden="true" />
              <span>Manage locations</span>
            </Link>
            <Link to="/admin/lead-sources">
              <RadioTower aria-hidden="true" />
              <span>Manage lead sources</span>
            </Link>
            {canManageUsers && (
              <Link to="/admin/cost-basis">
                <CircleDollarSign aria-hidden="true" />
                <span>Manage cost/revenue</span>
              </Link>
            )}
          </nav>
        </SettingsPanel>
      )}

      <section className="account-actions" aria-label="Account actions">
        <button className="logout-action" type="button" onClick={logout}>
          <LogOut aria-hidden="true" />
          Logout
        </button>
      </section>
    </section>
  );
}

export default Account;
