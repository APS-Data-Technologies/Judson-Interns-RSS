import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useAuth from "../../features/auth/useAuth";
import {
  createUser,
  deactivateUser,
  listUserLocations,
  listUsers,
  updateUser,
} from "../../features/auth/userApi";
import useUnsavedChangesPrompt from "../../hooks/useUnsavedChangesPrompt";
import "./Admin.css";

const emptyForm = {
  email: "",
  first_name: "",
  last_name: "",
  role: "staff",
  location: "",
  password: "",
};

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
};

function getErrorMessage(error) {
  const data = error.response?.data;
  if (!data) return "Unable to complete the request.";
  if (data.detail) return data.detail;
  const firstValue = Object.values(data)[0];
  return Array.isArray(firstValue) ? firstValue[0] : String(firstValue);
}

function getUserForm(user) {
  return {
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    location: user.location || "",
    password: "",
  };
}

function Admin() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const canManageUsers = currentUser.role === "super_admin";
  const canManageAdmin = ["admin", "super_admin"].includes(currentUser.role);
  const adminSection = location.pathname.includes("/admin/locations")
    ? "locations"
    : location.pathname.includes("/admin/lead-sources")
      ? "leadSources"
      : "users";
  const editingSelf = editingId === currentUser.id;
  const userParam =
    location.pathname === "/admin/users/new"
      ? "new"
      : location.pathname.includes("/admin/users/") && location.pathname.endsWith("/edit")
        ? params.id
        : searchParams.get("user");
  const isUserFormDirty = useMemo(
    () => isFormOpen && JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm, isFormOpen],
  );

  useUnsavedChangesPrompt(isUserFormDirty && !isSaving);

  const loadData = useCallback(async () => {
    if (!canManageUsers) {
      setIsLoading(false);
      return;
    }
    setError("");
    try {
      const [userData, locationData] = await Promise.all([listUsers(), listUserLocations()]);
      setUsers(userData);
      setLocations(locationData);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [canManageUsers]);

  useEffect(() => {
    if (!canManageUsers) return undefined;

    let cancelled = false;
    Promise.all([listUsers(), listUserLocations()])
      .then(([userData, locationData]) => {
        if (!cancelled) {
          setUsers(userData);
          setLocations(locationData);
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canManageUsers]);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setError("");
    setIsFormOpen(true);
    navigate("/admin/users/new");
  }

  function openEditForm(user) {
    const nextForm = getUserForm(user);
    setEditingId(user.id);
    setForm(nextForm);
    setInitialForm(nextForm);
    setError("");
    setIsFormOpen(true);
    navigate(`/admin/users/${user.id}/edit`);
  }

  function closeForm() {
    if (isUserFormDirty && !window.confirm("You have unsaved changes. Close this form?")) {
      return;
    }

    setIsFormOpen(false);
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setEditingId(null);
    navigate("/admin/users");
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "role" && value !== "staff" ? { location: "" } : {}),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const payload = {
      ...form,
      location: form.role === "staff" ? Number(form.location) : null,
    };
    if (!payload.password) delete payload.password;

    try {
      if (editingId) {
        await updateUser(editingId, payload);
      } else {
        await createUser(payload);
      }
      setIsFormOpen(false);
      setForm(emptyForm);
      setInitialForm(emptyForm);
      setEditingId(null);
      navigate("/admin/users", { replace: true });
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(user) {
    setError("");
    try {
      if (user.is_active) {
        await deactivateUser(user.id);
      } else {
        await updateUser(user.id, { is_active: true });
      }
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  useEffect(() => {
    if (!canManageUsers) return;

    queueMicrotask(() => {
      if (userParam === "new") {
        if (!isFormOpen || editingId !== null) {
          setEditingId(null);
          setForm(emptyForm);
          setInitialForm(emptyForm);
          setError("");
          setIsFormOpen(true);
        }
        return;
      }

      if (userParam) {
        const selectedUser = users.find((user) => String(user.id) === userParam);
        if (!selectedUser) return;

        if (!isFormOpen || editingId !== selectedUser.id) {
          const nextForm = getUserForm(selectedUser);
          setEditingId(selectedUser.id);
          setForm(nextForm);
          setInitialForm(nextForm);
          setError("");
          setIsFormOpen(true);
        }
        return;
      }

      if (isFormOpen) {
        setIsFormOpen(false);
        setForm(emptyForm);
        setInitialForm(emptyForm);
        setEditingId(null);
      }
    });
  }, [canManageUsers, editingId, isFormOpen, userParam, users]);

  if (location.pathname === "/admin") {
    return <Navigate to="/admin/users" replace />;
  }

  if (!canManageAdmin) {
    return (
      <section className="admin-page">
        <header className="page-heading"><h2>Administration</h2></header>
        <p className="empty-state">No system settings are available.</p>
      </section>
    );
  }

  function renderAdminNavigation() {
    return (
      <nav className="admin-tabs" aria-label="Admin sections">
        {canManageUsers && <NavLink to="/admin/users">Users</NavLink>}
        <NavLink to="/admin/locations">Locations</NavLink>
        <NavLink to="/admin/lead-sources">Lead Sources</NavLink>
      </nav>
    );
  }

  if (adminSection === "locations") {
    return (
      <section className="admin-page">
        {renderAdminNavigation()}
        <header className="admin-heading">
          <div><h2>Manage locations</h2><p>Location navigation</p></div>
          <Link className="admin-primary-link" to="/admin/locations/new">Add location</Link>
        </header>
        <div className="admin-route-list">
          <Link to="/admin/locations/new">Add location</Link>
          <Link to="/admin/locations/1/edit">Edit location</Link>
        </div>
        <p className="empty-state">Location management content will be built here.</p>
      </section>
    );
  }

  if (adminSection === "leadSources") {
    return (
      <section className="admin-page">
        {renderAdminNavigation()}
        <header className="admin-heading">
          <div><h2>Manage lead sources</h2><p>Lead source navigation</p></div>
          <Link className="admin-primary-link" to="/admin/lead-sources/new">Add lead source</Link>
        </header>
        <div className="admin-route-list">
          <Link to="/admin/lead-sources/new">Add lead source</Link>
          <Link to="/admin/lead-sources/1/edit">Edit lead source</Link>
        </div>
        <p className="empty-state">Lead source management content will be built here.</p>
      </section>
    );
  }

  if (!canManageUsers) {
    return (
      <section className="admin-page">
        {renderAdminNavigation()}
        <header className="page-heading"><h2>Manage users</h2></header>
        <p className="empty-state">Only Super Admin users can manage users.</p>
      </section>
    );
  }

  return (
    <section className="admin-page">
      {renderAdminNavigation()}
      <header className="admin-heading">
        <div><h2>User management</h2><p>{users.length} accounts</p></div>
        <button type="button" onClick={openCreateForm}>Add user</button>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}

      {isFormOpen && (
        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <h3>{editingId ? "Edit user" : "Add user"}</h3>
            <button type="button" onClick={closeForm}>Cancel</button>
          </div>
          <label htmlFor="user-first-name">First name</label>
          <input id="user-first-name" value={form.first_name} onChange={(event) => updateForm("first_name", event.target.value)} required />
          <label htmlFor="user-last-name">Last name</label>
          <input id="user-last-name" value={form.last_name} onChange={(event) => updateForm("last_name", event.target.value)} required />
          <label htmlFor="user-email">Email</label>
          <input id="user-email" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} required />
          <label htmlFor="user-role">Role</label>
          <select id="user-role" value={form.role} onChange={(event) => updateForm("role", event.target.value)} disabled={editingSelf}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          {form.role === "staff" && (
            <>
              <label htmlFor="user-location">Location</label>
              <select id="user-location" value={form.location} onChange={(event) => updateForm("location", event.target.value)} required>
                <option value="">Select location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.location_name}</option>)}
              </select>
            </>
          )}
          {!editingSelf && (
            <>
              <label htmlFor="user-password">{editingId ? "Reset password (optional)" : "Temporary password"}</label>
              <input id="user-password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} required={!editingId} minLength="8" />
            </>
          )}
          <button className="primary-action" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save user"}</button>
        </form>
      )}

      <div className="user-list">
        {isLoading && <p className="empty-state">Loading users...</p>}
        {!isLoading && users.map((user) => (
          <article className="user-row" key={user.id}>
            <div className="user-summary">
              <strong>{`${user.first_name} ${user.last_name}`.trim() || user.email}</strong>
              <span>{user.email}</span>
              <span>{roleLabels[user.role]}{user.location_name ? ` - ${user.location_name}` : ""}</span>
            </div>
            <div className="user-status-actions">
              <span className={user.is_active ? "status-active" : "status-inactive"}>{user.is_active ? "Active" : "Inactive"}</span>
              <button type="button" onClick={() => openEditForm(user)}>Edit</button>
              {user.id !== currentUser.id && <button type="button" onClick={() => handleStatusChange(user)}>{user.is_active ? "Deactivate" : "Reactivate"}</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Admin;
