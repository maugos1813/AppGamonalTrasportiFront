import { api } from "./api";

export const registerRequest = (payload) =>
  api.post("/auth/register", payload).then((res) => res.data.data);

export const loginRequest = (payload) =>
  api.post("/auth/login", payload).then((res) => res.data.data);

export const meRequest = () => api.get("/auth/me").then((res) => res.data.data.user);

export const forgotPasswordRequest = (correoElectronico) =>
  api.post("/auth/forgot-password", { correoElectronico }).then((res) => res.data);

export const resetPasswordRequest = (token, newPassword) =>
  api.post("/auth/reset-password", { token, newPassword }).then((res) => res.data);
