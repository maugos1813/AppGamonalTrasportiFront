import { api } from "./api";

const BASE = "/combustible";

// fields: texto (los undefined se omiten); files: { comprobante } (File).
const toFormData = (fields = {}, files = {}) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  Object.entries(files).forEach(([key, file]) => {
    if (file) formData.append(key, file);
  });
  return formData;
};

// Devuelve { items, total, page, pageSize }.
export const listCombustibleRequest = (params) =>
  api.get(BASE, { params }).then((res) => res.data.data);

// Cantidad y total en plata por area: { DHL_MILANO: { count, total }, ... }.
export const getCombustibleSummaryRequest = (params) =>
  api.get(`${BASE}/summary`, { params }).then((res) => res.data.data.summary);

// Indicadores del encabezado: gasto del mes, comparacion, gasto por area y por chofer y
// serie mensual.
export const getCombustibleStatsRequest = (params) =>
  api.get(`${BASE}/stats`, { params }).then((res) => res.data.data.stats);

// Gasolineras ya usadas: [{ nombre, count }], de la mas frecuente a la menos.
export const listCombustibleMetodosRequest = () =>
  api.get(`${BASE}/metodos`).then((res) => res.data.data.metodos);

export const getCombustibleRequest = (id) =>
  api.get(`${BASE}/${id}`).then((res) => res.data.data.registro);

export const createCombustibleRequest = (fields, files) =>
  api.post(BASE, toFormData(fields, files)).then((res) => res.data.data.registro);

export const updateCombustibleRequest = (id, fields, files) =>
  api.patch(`${BASE}/${id}`, toFormData(fields, files)).then((res) => res.data.data.registro);

export const deleteCombustibleRequest = (id) => api.delete(`${BASE}/${id}`);
