export const isGpsFailing = (gps) => gps?.estado === "BLOQUEADO" || gps?.estado === "CAIDO";

export const gpsEstadoTitle = (gps) =>
  gps?.estado === "BLOQUEADO" ? "El GPS de la flota (OneSystec) esta bloqueado" : "El GPS de la flota (OneSystec) no responde";

export const fuenteLabel = (fuente) =>
  fuente === "CELULAR" ? "Celular" : fuente === "MIXTO" ? "Vehiculo + celular" : null;
