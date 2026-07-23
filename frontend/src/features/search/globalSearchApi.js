import api from "../../services/api/api";

export async function globalSearch(query, signal) {
  const response = await api.get("/search/global/", {
    params: { q: query, limit: 5 },
    signal,
  });
  return response.data;
}
