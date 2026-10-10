// Seguimiento en vivo de servicios (pagina /mapa/seguimiento). Un color por tipo de servicio; el rojo queda para "sin GPS".
export const SEGUIMIENTO_TIPOS = [
  { key: "dhl-milano", label: "DHL Milano", color: "#f5c518" },
  { key: "dhl-roma", label: "DHL Roma", color: "#fb923c" },
  { key: "ab-service", label: "AB Service", color: "#22d3ee" },
  { key: "piazza-milano", label: "Extras Piazza Milano", color: "#a78bfa" },
  { key: "piazza-roma", label: "Extras Piazza Roma", color: "#f472b6" },
  { key: "otros", label: "Otros", color: "#94a3b8" },
];

export const SEGUIMIENTO_COLOR_SIN_GPS = "#ff3b57";
export const SEGUIMIENTO_COLOR_RETRASO = "#ffb020";

export const tipoMeta = (key) => SEGUIMIENTO_TIPOS.find((t) => t.key === key) ?? SEGUIMIENTO_TIPOS[SEGUIMIENTO_TIPOS.length - 1];

// A partir de cuantos minutos sobre la ETA se considera fuera de hora (igual que el backend: RETRASO_AVISO_MIN).
export const RETRASO_AVISO_MIN = 5;

export const FUENTE_GPS_LABEL = {
  VEHICULO: "GPS del vehículo",
  CELULAR: "GPS del celular",
  SIMULADO: "Sin GPS · recorrido simulado",
};

export const horaRoma = (value) =>
  value
    ? new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Rome" })
    : "—";

export const minutosTexto = (min) => {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

// Alertas de la campanita a partir del seguimiento: servicio sin ningun GPS y servicio fuera de su ETA.
export const computeSeguimientoAlerts = (data) =>
  (data?.alertas ?? []).map((a) => ({
    id: a.id,
    severity: a.severity,
    message: a.message,
    link: `/mapa/seguimiento?servicio=${a.recordId}`,
  }));
