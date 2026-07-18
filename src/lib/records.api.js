import { api } from "./api";

export const listRecordsRequest = () =>
  api.get("/records").then((res) => res.data.data.records);

// Resumen liviano (id/fechaServicio/estado) de un mes, para armar el acordeon de
// dias sin traer stops/ruta/economico de cada registro.
export const listRecordsSummaryByMonthRequest = (year, month) =>
  api.get(`/records/${year}/${month}/summary`).then((res) => res.data.data.records);

// Registros completos de un dia especifico (se piden recien al desplegar ese dia).
export const listRecordsByDayRequest = (year, month, day) =>
  api.get(`/records/${year}/${month}/${day}`).then((res) => res.data.data.records);

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

export const uploadRecordFileRequest = (id, file, tipoArchivo) => {
  const formData = new FormData();
  formData.append("archivo", file);
  formData.append("tipoArchivo", tipoArchivo);
  return api
    .post(`/records/${id}/files`, formData)
    .then((res) => res.data.data.file);
};
