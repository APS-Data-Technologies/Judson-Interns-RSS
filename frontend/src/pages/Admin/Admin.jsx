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
import {
  createLocation,
  listLocations as listManagedLocations,
  updateLocation as saveLocation,
} from "../../features/admin/locationApi";
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

const emptyLocationForm = {
  external_id: "",
  location_name: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  phone: "",
  is_active: true,
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

function getLocationForm(location) {
  return {
    external_id: location.external_id || "",
    location_name: location.location_name || "",
    address: location.address || "",
    city: location.city || "",
    state: location.state || "",
    zip_code: location.zip_code || "",
    phone: location.phone || "",
    is_active: location.is_active,
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
  const [managedLocations, setManagedLocations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [initialLocationForm, setInitialLocationForm] = useState(emptyLocationForm);
  const [editingId, setEditingId] = useState(null);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);
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
  const locationParam =
    location.pathname === "/admin/locations/new"
      ? "new"
      : location.pathname.includes("/admin/locations/") && location.pathname.endsWith("/edit")
        ? params.id
        : searchParams.get("location");
  const isUserFormDirty = useMemo(
    () => isFormOpen && JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm, isFormOpen],
  );
  const isLocationFormDirty = useMemo(
    () =>
      isLocationFormOpen
      && JSON.stringify(locationForm) !== JSON.stringify(initialLocationForm),
    [initialLocationForm, isLocationFormOpen, locationForm],
  );

  useUnsavedChangesPrompt(isUserFormDirty && !isSaving);
  useUnsavedChangesPrompt(isLocationFormDirty && !isSaving);

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

  const loadManagedLocations = useCallback(async () => {
    if (!canManageAdmin) {
      return;
    }
    setError("");
    try {
      const locationData = await listManagedLocations({ include_inactive: true });
      setManagedLocations(locationData);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }, [canManageAdmin]);

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

  useEffect(() => {
    if (adminSection !== "locations" || !canManageAdmin) return undefined;

    let cancelled = false;
    listManagedLocations({ include_inactive: true })
      .then((locationData) => {
        if (!cancelled) {
          setManagedLocations(locationData);
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
  }, [adminSection, canManageAdmin]);

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

  function openCreateLocationForm() {
    setEditingLocationId(null);
    setLocationForm(emptyLocationForm);
    setInitialLocationForm(emptyLocationForm);
    setError("");
    setIsLocationFormOpen(true);
    navigate("/admin/locations/new");
  }

  function openEditLocationForm(locationItem) {
    const nextForm = getLocationForm(locationItem);
    setEditingLocationId(locationItem.id);
    setLocationForm(nextForm);
    setInitialLocationForm(nextForm);
    setError("");
    setIsLocationFormOpen(true);
    navigate(`/admin/locations/${locationItem.id}/edit`);
  }

  function closeLocationForm() {
    if (
      isLocationFormDirty
      && !window.confirm("You have unsaved changes. Close this form?")
    ) {
      return;
    }

    setIsLocationFormOpen(false);
    setLocationForm(emptyLocationForm);
    setInitialLocationForm(emptyLocationForm);
    setEditingLocationId(null);
    navigate("/admin/locations");
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "role" && value !== "staff" ? { location: "" } : {}),
    }));
  }

  function updateLocationForm(field, value) {
    setLocationForm((current) => ({
      ...current,
      [field]: value,
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

  async function handleLocationSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const payload = {
        ...locationForm,
        state: locationForm.state.trim().toUpperCase(),
      };
      if (!payload.external_id) delete payload.external_id;

      if (editingLocationId) {
        await saveLocation(editingLocationId, payload);
      } else {
        await createLocation(payload);
      }

      setIsLocationFormOpen(false);
      setLocationForm(emptyLocationForm);
      setInitialLocationForm(emptyLocationForm);
      setEditingLocationId(null);
      navigate("/admin/locations", { replace: true });
      await loadManagedLocations();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLocationStatusChange(locationItem) {
    setError("");
    try {
      await saveLocation(locationItem.id, { is_active: !locationItem.is_active });
      await loadManagedLocations();
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

  useEffect(() => {
    if (adminSection !== "locations" || !canManageAdmin) return;

    queueMicrotask(() => {
      if (locationParam === "new") {
        if (!isLocationFormOpen || editingLocationId !== null) {
          setEditingLocationId(null);
          setLocationForm(emptyLocationForm);
          setInitialLocationForm(emptyLocationForm);
          setError("");
          setIsLocationFormOpen(true);
        }
        return;
      }

      if (locationParam) {
        const selectedLocation = managedLocations.find(
          (locationItem) => String(locationItem.id) === locationParam,
        );
        if (!selectedLocation) return;

        if (!isLocationFormOpen || editingLocationId !== selectedLocation.id) {
          const nextForm = getLocationForm(selectedLocation);
          setEditingLocationId(selectedLocation.id);
          setLocationForm(nextForm);
          setInitialLocationForm(nextForm);
          setError("");
          setIsLocationFormOpen(true);
        }
        return;
      }

      if (isLocationFormOpen) {
        setIsLocationFormOpen(false);
        setLocationForm(emptyLocationForm);
        setInitialLocationForm(emptyLocationForm);
        setEditingLocationId(null);
      }
    });
  }, [
    adminSection,
    canManageAdmin,
    editingLocationId,
    isLocationFormOpen,
    locationParam,
    managedLocations,
  ]);

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
          <div><h2>Manage locations</h2><p>{managedLocations.length} locations</p></div>
          <button type="button" onClick={openCreateLocationForm}>Add location</button>
        </header>

        {error && <p className="form-error" role="alert">{error}</p>}

        {isLocationFormOpen && (
          <form className="user-form" onSubmit={handleLocationSubmit}>
            <div className="form-heading">
              <h3>{editingLocationId ? "Edit location" : "Add location"}</h3>
              <button type="button" onClick={closeLocationForm}>Cancel</button>
            </div>
            <label htmlFor="location-external-id">External ID</label>
            <input id="location-external-id" value={locationForm.external_id} onChange={(event) => updateLocationForm("external_id", event.target.value)} />
            <label htmlFor="location-name">Location name</label>
            <input id="location-name" value={locationForm.location_name} onChange={(event) => updateLocationForm("location_name", event.target.value)} required />
            <label htmlFor="location-address">Address</label>
            <input id="location-address" value={locationForm.address} onChange={(event) => updateLocationForm("address", event.target.value)} required />
            <label htmlFor="location-city">City</label>
            <input id="location-city" value={locationForm.city} onChange={(event) => updateLocationForm("city", event.target.value)} required />
            <label htmlFor="location-state">State</label>
            <input id="location-state" value={locationForm.state} onChange={(event) => updateLocationForm("state", event.target.value)} maxLength="2" required />
            <label htmlFor="location-zip">ZIP code</label>
            <input id="location-zip" value={locationForm.zip_code} onChange={(event) => updateLocationForm("zip_code", event.target.value)} required />
            <label htmlFor="location-phone">Phone</label>
            <input id="location-phone" type="tel" value={locationForm.phone} onChange={(event) => updateLocationForm("phone", event.target.value)} />
            <label className="admin-checkbox" htmlFor="location-active">
              <input id="location-active" type="checkbox" checked={locationForm.is_active} onChange={(event) => updateLocationForm("is_active", event.target.checked)} />
              <span>Location is active</span>
            </label>
            <button className="primary-action" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save location"}
            </button>
          </form>
        )}

        <div className="user-list">
          {isLoading && <p className="empty-state">Loading locations...</p>}
          {!isLoading && managedLocations.map((locationItem) => (
            <article className="user-row" key={locationItem.id}>
              <div className="user-summary">
                <strong>{locationItem.location_name}</strong>
                <span>{locationItem.address}</span>
                <span>
                  {locationItem.city}, {locationItem.state} {locationItem.zip_code}
                </span>
                {locationItem.phone && <span>{locationItem.phone}</span>}
              </div>
              <div className="user-status-actions">
                <span className={locationItem.is_active ? "status-active" : "status-inactive"}>
                  {locationItem.is_active ? "Active" : "Inactive"}
                </span>
                <button type="button" onClick={() => openEditLocationForm(locationItem)}>Edit</button>
                <button type="button" onClick={() => handleLocationStatusChange(locationItem)}>
                  {locationItem.is_active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </article>
          ))}
        </div>
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
