import "./Header.css";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../../features/auth/useAuth";

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="app-header">
      <div className="header-identity">
        <p className="eyebrow">Ready Set STEM</p>
        <h1>Dashboard</h1>
      </div>
      <div className="header-account">
        <Link to="/settings">{user.first_name || user.email}</Link>
        <button type="button" onClick={handleLogout}>Sign out</button>
      </div>
    </header>
  );
}

export default Header;
