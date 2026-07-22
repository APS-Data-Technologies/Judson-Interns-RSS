import api from "../../services/api/api";

export async function listCostBasis() {
  const response = await api.get("/cost-basis/");
  return response.data;
}

export async function createCostBasis(data) {
  const response = await api.post("/cost-basis/", data);
  return response.data;
}

export async function updateCostBasis(id, data) {
  const response = await api.patch(`/cost-basis/${id}/`, data);
  return response.data;
}
