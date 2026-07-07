import api from "../../services/api/api";

export async function listUsers() {
  const response = await api.get("/users/");
  return response.data;
}

export async function createUser(data) {
  const response = await api.post("/users/", data);
  return response.data;
}

export async function updateUser(id, data) {
  const response = await api.patch(`/users/${id}/`, data);
  return response.data;
}

export async function deactivateUser(id) {
  await api.delete(`/users/${id}/`);
}

export async function listUserLocations() {
  const response = await api.get("/user-locations/");
  return response.data;
}
