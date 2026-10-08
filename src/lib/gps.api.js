import { api } from "./api";

// Estado del GPS de la flota (OneSystec) y del respaldo con el celular (solo oficina).
// verificar: fuerza una comprobacion nueva ahora.
export const getGpsEstadoRequest = ({ verificar = false } = {}) =>
  api.get("/gps/estado", { params: verificar ? { verificar: 1 } : undefined }).then((res) => res.data.data);

// ---- Respaldo con el celular del chofer
export const getMyGpsRespaldoRequest = () => api.get("/users/me/gps-respaldo").then((res) => res.data.data);

export const setMyGpsRespaldoRequest = (permitido) =>
  api.patch("/users/me/gps-respaldo", { permitido }).then((res) => res.data.data.user);

// Devuelve { guardado, activo, motivo }: si "activo" es false, la app deja de enviar.
export const sendGpsRespaldoLocationRequest = (lat, lng, accuracy) =>
  api
    .post("/users/me/gps-respaldo/ubicacion", { lat, lng, ...(accuracy != null ? { accuracy } : {}) })
    .then((res) => res.data.data);
