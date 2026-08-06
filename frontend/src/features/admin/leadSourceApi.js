import api from "../../services/api/api";

export async function listLeadSources(params = {}) {
  const response = await api.get("/manage-lead-sources/", { params });
  return response.data;
}

export async function createLeadSource(data) {
  const response = await api.post("/manage-lead-sources/", data);
  return response.data;
}

export async function updateLeadSource(id, data) {
  const response = await api.patch(`/manage-lead-sources/${id}/`, data);
  return response.data;
}
