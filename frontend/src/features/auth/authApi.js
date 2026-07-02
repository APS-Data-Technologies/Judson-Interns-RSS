import api from "../../services/api/api";

export async function loginRequest(credentials) {
  const response = await api.post("/auth/login/", credentials);
  return response.data;
}

export async function logoutRequest() {
  await api.post("/auth/logout/");
}

export async function currentUserRequest() {
  const response = await api.get("/auth/me/");
  return response.data;
}

export async function changePasswordRequest(passwords) {
  const response = await api.post("/auth/change-password/", passwords);
  return response.data;
}
