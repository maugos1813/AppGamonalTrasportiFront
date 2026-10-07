import { api } from "./api";

const BASE = "/finanzas";

// month: "AAAA-MM" (por defecto, el mes en curso de Roma).
export const getFinanzasResumenRequest = (month) =>
  api.get(`${BASE}/resumen`, { params: { month } }).then((res) => res.data.data.resumen);

// Pago a choferes del mes: total, resumen por chofer y (si se pide un chofer, o si quien
// consulta es chofer) el detalle servicio por servicio.
export const getPagosChoferesRequest = (params) =>
  api.get(`${BASE}/pagos`, { params }).then((res) => res.data.data.pagos);

// Gastos cargados en los servicios del mes (peajes, Area C, hotel...). Solo OWNER/ADMIN.
export const getGastosServiciosRequest = (month) =>
  api.get(`${BASE}/gastos-servicios`, { params: { month } }).then((res) => res.data.data.gastos);
