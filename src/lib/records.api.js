import { api } from "./api";

export const listRecordsRequest = () =>
  api.get("/records").then((res) => res.data.data.records);

export const createRecordRequest = (payload) =>
  api.post("/records", payload).then((res) => res.data.data.record);

export const getRecordRequest = (id) =>
  api.get(`/records/${id}`).then((res) => res.data.data.record);

export const updateRecordRequest = (id, payload) =>
  api.patch(`/records/${id}`, payload).then((res) => res.data.data.record);

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
