import api from "../../services/api/api";

export async function getCohortAnalytics(params = {}) {
  const response = await api.get("/analytics/cohort/", { params });
  return response.data;
}
