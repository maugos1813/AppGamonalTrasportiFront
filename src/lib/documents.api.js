import { api } from "./api";

export const listDocumentsRequest = (usuarioId) =>
  api.get("/documents", { params: { usuarioId } }).then((res) => res.data.data.documents);

export const createDocumentRequest = (usuarioId, tipoDocumento, file) => {
  const formData = new FormData();
  formData.append("archivo", file);
  formData.append("tipoDocumento", tipoDocumento);
  formData.append("usuarioId", usuarioId);
  return api.post("/documents", formData).then((res) => res.data.data.document);
};

export const updateDocumentRequest = (id, file) => {
  const formData = new FormData();
  formData.append("archivo", file);
  return api.patch(`/documents/${id}`, formData).then((res) => res.data.data.document);
};
