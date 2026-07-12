import axios from "axios";
import { clearToken, getToken } from "./token";

export const AUTH_LOGOUT_EVENT = "gt:auth-logout";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    }
    return Promise.reject(error);
  }
);

// Traduce un error de axios (respuesta del backend { success, message, details }) a un
// objeto { message, fieldErrors } consistente para mostrar en formularios y alertas.
export const parseApiError = (error) => {
  const data = error.response?.data;
  return {
    message: data?.message || "No se pudo conectar con el servidor. Intenta de nuevo.",
    fieldErrors: data?.details || null,
    status: error.response?.status,
  };
};
