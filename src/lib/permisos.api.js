import { api } from "./api";

const BASE = "/permisos";

// month "AAAA-MM". driverId solo lo usa la oficina (el chofer siempre ve el suyo).
export const getCalendarioRequest = ({ month, driverId }) =>
  api.get(`${BASE}/calendario`, { params: { month, driverId } }).then((res) => res.data.data);

// estado: PENDIENTE | APROBADO | RECHAZADO | TODAS.
export const listPermisosRequest = ({ estado = "TODAS", driverId } = {}) =>
  api.get(BASE, { params: { estado, driverId } }).then((res) => res.data.data.items);

// body: { tipo, fechaDesde, fechaHasta?, motivo, driverId? } (driverId solo oficina). La fecha y hora
// de la solicitud las pone el servidor.
export const createPermisoRequest = (body) => api.post(BASE, body).then((res) => res.data.data);

// body: { accion: "APROBAR" | "RECHAZAR", respuesta?, forzar? } (forzar: aprobar aunque pase el tope).
export const reviewPermisoRequest = (id, body) =>
  api.post(`${BASE}/${id}/revision`, body).then((res) => res.data.data);

export const deletePermisoRequest = (id) => api.delete(`${BASE}/${id}`);

// Tope de permisos por dia (null = sin tope). Lo edita la oficina.
export const getPermisosConfigRequest = () => api.get(`${BASE}/config`).then((res) => res.data.data);
export const setPermisosConfigRequest = (maxPorDia) =>
  api.put(`${BASE}/config`, { maxPorDia }).then((res) => res.data.data);

// Asistencia del mes de todos los choferes activos (solo oficina): [{ driver, summary, pendientes }].
export const getAsistenciaResumenRequest = (month) =>
  api.get(`${BASE}/resumen`, { params: { month } }).then((res) => res.data.data.items);
