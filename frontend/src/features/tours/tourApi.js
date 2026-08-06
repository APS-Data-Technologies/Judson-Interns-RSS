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

export async function getTour(tourId) {
  const response = await api.get(`/tours/${tourId}/`);
  return response.data;
}

export async function updateTour(tourId, payload) {
  const response = await api.patch(`/tours/${tourId}/`, payload);
  return response.data;
}

export async function transitionTourStatus(tourId, payload) {
  const response = await api.post(`/tours/${tourId}/status/`, payload);
  return response.data;
}

export async function rescheduleTour(tourId, payload) {
  const response = await api.post(`/tours/${tourId}/reschedule/`, payload);
  return response.data;
}

export async function cancelTour(tourId, payload = {}) {
  const response = await api.post(`/tours/${tourId}/cancel/`, payload);
  return response.data;
}

export async function getTourEvents(tourId) {
  const response = await api.get(`/tours/${tourId}/events/`);
  return response.data;
}
