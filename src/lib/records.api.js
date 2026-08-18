import { api } from "./api";

// params: { days?: number } - sin days, trae todo el historico (comportamiento de
// siempre); con days, acota a los ultimos N dias (ver ?days en record.controller.js).
export const listRecordsRequest = (params) =>
  api.get("/records", { params }).then((res) => res.data.data.records);

// Panel de "Pendientes" de Registros: acotado a los servicios de HOY en el backend,
// no el historico completo (no tiene sentido traer miles de registros para filtrar
// los pocos que estan en curso ahora mismo).
export const listPendingRecordsRequest = () =>
  api.get("/records/pending").then((res) => res.data.data.records);

// Buscador de Registros (codigo/cliente/chofer/destino) - filtra en el backend, no
// trae el historico completo para buscar en el navegador.
export const searchRecordsRequest = (q) =>
  api.get("/records/search", { params: { q } }).then((res) => res.data.data.records);

// Export CSV de Registros (ver ExportRecordsModal.jsx) - todos los filtros son
// opcionales, se mandan tal cual (undefined se omite solo, axios no lo serializa).
export const exportRecordsRequest = (filters) =>
  api.get("/records/export", { params: filters }).then((res) => res.data.data.records);

// Registros cuyo ultimo intento de sincronizar con AppSheet fallo (campanita OWNER/ADMIN).
export const listAppsheetSyncFailuresRequest = () =>
  api.get("/records/sync-fallidos").then((res) => res.data.data.records);

// Resumen liviano (id/fechaServicio/estado) de un mes, para armar el acordeon de
// dias sin traer stops/ruta/economico de cada registro.
export const listRecordsSummaryByMonthRequest = (year, month) =>
  api.get(`/records/${year}/${month}/summary`).then((res) => res.data.data.records);

// Registros completos de un dia especifico (se piden recien al desplegar ese dia).
export const listRecordsByDayRequest = (year, month, day) =>
  api.get(`/records/${year}/${month}/${day}`).then((res) => res.data.data.records);

// Registros completos de un mes especifico (ej. ranking de KM de flota del mes en
// Vehiculos) - acotado a ese mes, no el historico completo.
export const listRecordsByMonthRequest = (year, month) =>
  api.get(`/records/${year}/${month}`).then((res) => res.data.data.records);

export const createRecordRequest = (payload) =>
  api.post("/records", payload).then((res) => res.data.data.record);

export const getRecordRequest = (id) =>
  api.get(`/records/${id}`).then((res) => res.data.data.record);

export const updateRecordRequest = (id, payload) =>
  api.patch(`/records/${id}`, payload).then((res) => res.data.data.record);

// Solo OWNER/ADMIN (el backend lo restringe igual). El registro se elimina
// definitivamente, con sus paradas y archivos asociados.
export const deleteRecordRequest = (id) => api.delete(`/records/${id}`);

export const listRecordFilesRequest = (id) =>
  api.get(`/records/${id}/files`).then((res) => res.data.data.files);

// A demanda desde el mapa: solo se pide para el servicio abierto/seleccionado, no para
// todos los servicios activos en cada refresco de posiciones.
export const getRecordLiveEtaRequest = (id) =>
  api.get(`/records/${id}/eta-en-vivo`).then((res) => res.data.data.eta);

export const uploadRecordFileRequest = (id, file, tipoArchivo) => {
  const formData = new FormData();
  formData.append("archivo", file);
  formData.append("tipoArchivo", tipoArchivo);
  return api
    .post(`/records/${id}/files`, formData)
    .then((res) => res.data.data.file);
};
