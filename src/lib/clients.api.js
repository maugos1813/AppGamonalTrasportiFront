import { api } from "./api";

export const listClientsRequest = () =>
  api.get("/clients").then((res) => res.data.data.clients);

export const createClientRequest = (nombre) =>
  api.post("/clients", { nombre }).then((res) => res.data.data.client);
