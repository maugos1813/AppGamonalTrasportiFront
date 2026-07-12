import { api } from "./api";

export const listVehiclesRequest = () =>
  api.get("/vehiculos").then((res) => res.data.data.vehicles);

export const getVehicleRequest = (id) =>
  api.get(`/vehiculos/${id}`).then((res) => res.data.data.vehicle);

export const createVehicleRequest = (formData) =>
  api.post("/vehiculos", formData).then((res) => res.data.data.vehicle);
