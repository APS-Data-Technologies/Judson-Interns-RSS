import api from "../../services/api/api";

export async function getAnalyticsEngineStatus() {
  const response = await api.get("/analytics/engine/");
  return response.data;
}

export async function validateAnalyticsEngine() {
  const response = await api.post("/analytics/engine/", { action: "validate" });
  return response.data;
}
