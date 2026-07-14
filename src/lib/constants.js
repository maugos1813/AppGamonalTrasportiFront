// Punto de partida fijo de todo servicio (coincide con DEPOT_ORIGIN del backend).
// Aca es solo para mostrarlo en la UI, no se geocodifica en el frontend.
export const DEPOT_ORIGIN_LABEL = "Via Walter Tobagi, 8, 20068 Bettola-Zeloforamagno MI";

export const AREA_OPTIONS = [
  { value: "EXTRAS_PIAZZA", label: "Extras Piazza" },
  { value: "DHL", label: "DHL" },
  { value: "FARMACIA", label: "Farmacia" },
];

export const CARGO_LABELS = {
  OWNER: "Socio",
  ADMIN: "Responsable",
  CHOFER: "Chofer",
};

// Grupo operativo/organizacional del usuario (sucursal o socios), independiente del
// campo Area. Se usa para agrupar la lista de Choferes/Usuarios.
export const GRUPO_OPTIONS = [
  { value: "SOCIEDAD", label: "Sociedad" },
  { value: "MILANO_NORD", label: "Milano Nord" },
  { value: "MILANO_SUD", label: "Milano Sud" },
  { value: "ROMA", label: "Roma" },
  { value: "FARMACIA", label: "Farmacia" },
];

export const GRUPO_LABELS = Object.fromEntries(
  GRUPO_OPTIONS.map((opt) => [opt.value, opt.label])
);

export const RECORD_STATUS_OPTIONS = [
  { value: "IN_SOSPESO", label: "En suspenso" },
  { value: "IN_CONSEGNA", label: "En camino" },
  { value: "CONSEGNATO", label: "Entregado" },
  { value: "RITIRATO", label: "Retirado" },
  { value: "RISCHEDULATO", label: "Reprogramado" },
  { value: "ANNULLATO", label: "Anulado" },
];

// Circuito/aplicativo de reparto asignado al servicio (se carga por servicio, no por
// chofer, para conservar el historial exacto aunque el chofer cambie de aplicativo).
export const APLICATIVO_OPTIONS = Array.from({ length: 18 }, (_, i) => ({
  value: `MILANO_${i + 1}`,
  label: `MILANO ${i + 1}`,
}));

export const APLICATIVO_LABELS = Object.fromEntries(
  APLICATIVO_OPTIONS.map((opt) => [opt.value, opt.label])
);

export const RECORD_STATUS_LABELS = Object.fromEntries(
  RECORD_STATUS_OPTIONS.map((opt) => [opt.value, opt.label])
);

// Tono de badge por estado: se mapea a clases utilitarias en <StatusBadge />.
export const RECORD_STATUS_TONE = {
  IN_SOSPESO: "amber",
  IN_CONSEGNA: "blue",
  CONSEGNATO: "green",
  RITIRATO: "slate",
  RISCHEDULATO: "purple",
  ANNULLATO: "red",
};

// Division de la seccion Registros en 2 pestanias, y de "Servicio actual" en el
// dashboard del chofer. RISCHEDULATO se considera terminado (queda para
// reprogramarse como un nuevo servicio, no sigue abierto).
export const EN_PROCESO_STATUSES = ["IN_SOSPESO", "IN_CONSEGNA", "RITIRATO"];
export const TERMINADOS_STATUSES = ["CONSEGNATO", "ANNULLATO", "RISCHEDULATO"];

// Paleta categorica validada (contraste + separacion CVD) para el grafico de
// estados en el dashboard OWNER. Mismo orden que RECORD_STATUS_OPTIONS.
export const RECORD_STATUS_CHART_COLOR = {
  IN_SOSPESO: "#c98500",
  IN_CONSEGNA: "#3987e5",
  CONSEGNATO: "#008300",
  RITIRATO: "#199e70",
  RISCHEDULATO: "#9085e9",
  ANNULLATO: "#e66767",
};

export const CHART_COLORS = {
  facturacion: "#199e70",
  costos: "#9085e9",
  gananciaPositiva: "#0ca30c",
  gananciaNegativa: "#d03b3b",
};

export const VEHICLE_STATUS_OPTIONS = [
  { value: "DISPONIBLE", label: "Disponible" },
  { value: "EN_MANTENIMIENTO", label: "En mantenimiento" },
  { value: "FUERA_DE_SERVICIO", label: "Fuera de servicio" },
];

export const VEHICLE_STATUS_LABELS = Object.fromEntries(
  VEHICLE_STATUS_OPTIONS.map((opt) => [opt.value, opt.label])
);

export const VEHICLE_STATUS_TONE = {
  DISPONIBLE: "green",
  EN_MANTENIMIENTO: "amber",
  FUERA_DE_SERVICIO: "red",
};

export const TIPO_ARCHIVO_LABELS = {
  CMR: "CMR",
  FOTO_ENTREGA: "Foto de entrega",
  FACTURA: "Factura",
  COMPROBANTE: "Comprobante",
  OTRO: "Otro",
};

export const TIPO_DOCUMENTO_OPTIONS = [
  { value: "CARTA_IDENTITA", label: "Carta d'identita" },
  { value: "PATENTE", label: "Patente" },
  { value: "TRADUZIONE_PATENTE", label: "Traduzione patente" },
  { value: "CODICE_FISCALE", label: "Codice fiscale" },
  { value: "CONTRATO", label: "Contrato" },
  { value: "UNILAV", label: "UNILAV" },
  { value: "RESPONSIVAS", label: "Responsivas" },
  { value: "PERMESSO_TRASPORTO", label: "Permiso de trasporto" },
  { value: "PASSAPORTO", label: "Passaporto" },
  { value: "SOGGIORNO", label: "Soggiorno" },
  { value: "TREDICESIMA_QUATTORDICESIMA", label: "13ma/14ma" },
];
