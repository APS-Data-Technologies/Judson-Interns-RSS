import api from "../../services/api/api";

export async function listLocations(params = {}) {
  const response = await api.get("/locations/", { params });
  return response.data;
}

export async function createLocation(data) {
  const response = await api.post("/locations/", data);
  return response.data;
}

export async function updateLocation(id, data) {
  const response = await api.patch(`/locations/${id}/`, data);
  return response.data;
}
