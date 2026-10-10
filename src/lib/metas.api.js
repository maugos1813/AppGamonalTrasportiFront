import { api } from "./api";

const BASE = "/metas";

// { NOVATO: 1500, MASTER: null, SENIOR: 3500 } - meta mensual de km por nivel (null = sin definir).
export const getMetasConfigRequest = () => api.get(`${BASE}/config`).then((res) => res.data.data.metas);

export const setMetasConfigRequest = (metas) => api.put(`${BASE}/config`, metas).then((res) => res.data.data.metas);

// Avance del propio usuario: { nivel, meta, km, servicios, porcentaje, faltan, cumplida, month }.
export const getMyProgressRequest = (month) =>
  api.get(`${BASE}/mi-progreso`, { params: { month } }).then((res) => res.data.data);

// Estilo de manejo (OneSystec) de los ultimos 30 dias: { puntaje, dias, vehiculos } o null si no hay datos.
export const getMyDrivingStyleRequest = () =>
  api.get(`${BASE}/mi-estilo-manejo`).then((res) => res.data.data.estilo);

// Oficina: { month, metas, items: [{ id, nombre, apellido, nivel, meta, km, porcentaje, ... }] }.
export const listDriversProgressRequest = (month) =>
  api.get(`${BASE}/choferes`, { params: { month } }).then((res) => res.data.data);
