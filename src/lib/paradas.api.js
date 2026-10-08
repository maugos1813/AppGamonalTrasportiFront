import { api } from "./api";

const BASE = "/paradas";

// params: { from?, to? (AAAA-MM-DD), clase? (coma-separadas), vehicleId?, driverId? }.
export const listParadasRequest = (params) => api.get(BASE, { params }).then((res) => res.data.data);

export const getParadasEstadoRequest = () => api.get(`${BASE}/estado`).then((res) => res.data.data.estado);

// Direccion de retorno por defecto para la estimacion por ruta (sin GPS). direccion vacia = quitarla.
// Devuelve { configurada: { direccion, lat, lng } | null, porDefecto: { nombre, direccion } }.
export const getRetornoRequest = () => api.get(`${BASE}/retorno`).then((res) => res.data.data);
export const setRetornoRequest = (direccion) =>
  api.put(`${BASE}/retorno`, { direccion: direccion || null }).then((res) => res.data.data);
