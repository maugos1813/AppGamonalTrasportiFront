import { api } from "./api";

export const listBustasPagaRequest = (params) =>
  api.get("/busta-paga", { params }).then((res) => res.data.data.bustas);

export const uploadBustaPagaRequest = ({ choferId, anio, mes, archivo }) => {
  const form = new FormData();
  form.set("choferId", choferId);
  form.set("anio", String(anio));
  form.set("mes", String(mes));
  form.set("archivo", archivo);
  return api.post("/busta-paga", form).then((res) => res.data.data.busta);
};

// El chofer firma a mano (imagen PNG en base64) que recibe la busta paga.
export const signBustaPagaRequest = (id, firma) =>
  api.post(`/busta-paga/${id}/firma`, { firma, acepto: true }).then((res) => res.data.data.busta);

// URL temporal del PDF (unos 2 minutos).
export const getBustaPagaFileRequest = (id) => api.get(`/busta-paga/${id}/archivo`).then((res) => res.data.data);

export const getConstanciaRequest = (id) =>
  api.get(`/busta-paga/${id}/constancia`).then((res) => res.data.data.constancia);

export const deleteBustaPagaRequest = (id) => api.delete(`/busta-paga/${id}`);
