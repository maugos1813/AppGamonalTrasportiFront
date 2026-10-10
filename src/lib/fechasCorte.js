// Los avisos de servicios incompletos (pendientes, campanita, peajes y carburante) y los viajes compactos solo
// valen para los servicios de esta fecha en adelante (hora de Roma, "AAAA-MM-DD"), igual que en el servidor
// (config/viajes.js y config/faltantes.js). Lo anterior no genera avisos a nadie.
export const CORTE_AVISOS = "2026-10-01";

export const desdeCorte = (fechaServicio) =>
  new Date(fechaServicio).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }) >= CORTE_AVISOS;
