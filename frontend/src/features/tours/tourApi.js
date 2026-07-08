import api from "../../services/api/api";

export async function getHomeSummary(params = {}) {
  const response = await api.get("/home/summary/", { params });
  return response.data;
}

export async function getLocations() {
  const response = await api.get("/locations/");
  return response.data;
}

export async function getLeadSources() {
  const response = await api.get("/lead-sources/");
  return response.data;
}

export async function listTours(params = {}) {
  const response = await api.get("/tours/", { params });
  return response.data;
}

export async function createTour(payload) {
  const response = await api.post("/tours/", payload);
  return response.data;
}

export async function getTour(id) {
  const response = await api.get(`/tours/${id}/`);
  return response.data;
}

export async function updateTour(id, payload) {
  const response = await api.patch(`/tours/${id}/`, payload);
  return response.data;
}

export async function updateTourStatus(id, payload) {
  const response = await api.patch(`/tours/${id}/status/`, payload);
  return response.data;
}
