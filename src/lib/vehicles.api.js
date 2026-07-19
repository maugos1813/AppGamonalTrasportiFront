import { api } from "./api";

export const listVehiclesRequest = () =>
  api.get("/vehiculos").then((res) => res.data.data.vehicles);

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
