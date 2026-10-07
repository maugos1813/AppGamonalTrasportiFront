import { api } from "./api";

const BASE = "/paradas";

// params: { from?, to? (AAAA-MM-DD), clase? (coma-separadas), vehicleId?, driverId? }.
export const listParadasRequest = (params) => api.get(BASE, { params }).then((res) => res.data.data);

export const getParadasEstadoRequest = () => api.get(`${BASE}/estado`).then((res) => res.data.data.estado);
