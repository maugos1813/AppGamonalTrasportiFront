import { api } from "./api";

export const listUsersRequest = () =>
  api.get("/users").then((res) => res.data.data.users);

export const createUserRequest = (payload) =>
  api.post("/users", payload).then((res) => res.data.data.user);

export const getUserRequest = (id) =>
  api.get(`/users/${id}`).then((res) => res.data.data.user);

export const updateUserRequest = (id, payload) =>
  api.patch(`/users/${id}`, payload).then((res) => res.data.data.user);

export const deleteUserRequest = (id) => api.delete(`/users/${id}`);

export const uploadUserAvatarRequest = (id, file) => {
  const formData = new FormData();
  formData.append("imagen", file);
  return api.post(`/users/${id}/avatar`, formData).then((res) => res.data.data.user);
};

export const updateMyLocationRequest = (lat, lng) =>
  api.patch("/users/me/ubicacion", { lat, lng });

export const reportLocationPermissionRequest = (denegado) =>
  api.patch("/users/me/ubicacion-permiso", { denegado });

export const listDriverLocationsRequest = () =>
  api.get("/users/ubicaciones").then((res) => res.data.data.ubicaciones);

// A demanda desde el mapa: solo se pide para el chofer libre abierto/seleccionado, no
// para todos los choferes libres en cada refresco de posiciones.
export const getDriverReturnEtaRequest = (id) =>
  api.get(`/users/${id}/eta-regreso`).then((res) => res.data.data.eta);

// Ruta real (historial de pings GPS) de un chofer en un dia puntual.
export const getDriverRouteHistoryRequest = (id, year, month, day) =>
  api.get(`/users/${id}/ruta/${year}/${month}/${day}`).then((res) => res.data.data.puntos);
