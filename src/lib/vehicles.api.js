import { api } from "./api";

export const listVehiclesRequest = () =>
  api.get("/vehiculos").then((res) => res.data.data.vehicles);

// GPS del vehiculo (Velocity Fleet, seccion Mapa) - solo trae los vehiculos que
// tienen ese dispositivo instalado (no todos todavia). Ver MapPage.jsx: se usa para
// reemplazar la posicion del celular del chofer por la del vehiculo cuando esta
// disponible, mas precisa.
export const listVehicleLivePositionsRequest = () =>
  api.get("/vehiculos/live-positions").then((res) => res.data.data.positions);

export const getVehicleRequest = (id) =>
  api.get(`/vehiculos/${id}`).then((res) => res.data.data.vehicle);

export const createVehicleRequest = (formData) =>
  api.post("/vehiculos", formData).then((res) => res.data.data.vehicle);

export const updateVehicleRequest = (id, formData) =>
  api.patch(`/vehiculos/${id}`, formData).then((res) => res.data.data.vehicle);

export const deleteVehicleRequest = (id) => api.delete(`/vehiculos/${id}`);

export const registerVehicleKmRequest = (id, data) =>
  api.post(`/vehiculos/${id}/mantenimiento`, data).then((res) => res.data.data.vehicle);

export const listVehicleMantenimientosRequest = (id) =>
  api.get(`/vehiculos/${id}/mantenimiento`).then((res) => res.data.data.mantenimientos);

export const deleteVehicleMantenimientoRequest = (vehicleId, mantenimientoId) =>
  api.delete(`/vehiculos/${vehicleId}/mantenimiento/${mantenimientoId}`);
