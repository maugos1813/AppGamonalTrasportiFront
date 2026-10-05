// Las 6 areas de servicio de Registros. Cada servicio se clasifica por su spedizzione y su
// zona (Milano/Roma):
// - DHL + zona                   -> DHL Milano / DHL Roma
// - AB_SERVICE                   -> AB Service
// - EXTRA_PIAZZA (o sin valor)   -> Extras Piazza Milano / Roma (sin zona cuenta como Milano)
// - EXTRAS_STEFANIA y el resto   -> Otros
export const AREA_ALL = "todos";

export const RECORD_AREAS = [
  {
    key: "dhl-milano",
    label: "DHL Milano",
    initials: "DHL",
    colors: { bg: "#facc15", fg: "#1a1400" },
    chartColor: "#facc15",
    newPath: "/records/dhl-ab-service/new",
    newState: { spedizzione: "DHL", zona: "MILANO" },
  },
  {
    key: "dhl-roma",
    label: "DHL Roma",
    initials: "DHL",
    colors: { bg: "#facc15", fg: "#1a1400" },
    chartColor: "#fde68a",
    newPath: "/records/dhl-ab-service/new",
    newState: { spedizzione: "DHL", zona: "ROMA" },
  },
  {
    key: "piazza-milano",
    label: "Extras Piazza Milano",
    shortLabel: "Piazza Milano",
    initials: "EP",
    colors: { bg: "#94a3b8", fg: "#0b1220" },
    chartColor: "#94a3b8",
    newPath: "/records/extras-piazza/new",
    newState: { zona: "MILANO" },
  },
  {
    key: "piazza-roma",
    label: "Extras Piazza Roma",
    shortLabel: "Piazza Roma",
    initials: "EP",
    colors: { bg: "#94a3b8", fg: "#0b1220" },
    chartColor: "#64748b",
    newPath: "/records/extras-piazza/new",
    newState: { zona: "ROMA" },
  },
  {
    key: "ab-service",
    label: "AB Service",
    initials: "AB",
    colors: { bg: "#2f8dff", fg: "#ffffff" },
    chartColor: "#2f8dff",
    newPath: "/records/dhl-ab-service/new",
    newState: { spedizzione: "AB_SERVICE", zona: "MILANO" },
  },
  {
    key: "otros",
    label: "Otros",
    initials: "···",
    colors: { bg: "#475569", fg: "#e2e8f0" },
    chartColor: "#475569",
    newPath: "/records/extras-stefania/new",
    newState: {},
  },
];

export const AREAS_BY_KEY = Object.fromEntries(RECORD_AREAS.map((area) => [area.key, area]));

const zonaOf = (record) => (record.extrasPiazzaZona === "ROMA" ? "ROMA" : "MILANO");

export const classifyRecord = (record) => {
  if (record.spedizzione === "DHL") return zonaOf(record) === "ROMA" ? "dhl-roma" : "dhl-milano";
  if (record.spedizzione === "AB_SERVICE") return "ab-service";
  if (record.spedizzione === "EXTRAS_STEFANIA") return "otros";
  return zonaOf(record) === "ROMA" ? "piazza-roma" : "piazza-milano";
};

// Un ADMIN "de area" (ver lib/permissions.js) solo ve las secciones de su area; cada seccion
// de esa lista corresponde a estas areas nuevas.
const SECTION_TO_AREAS = {
  "extras-piazza": ["piazza-milano", "piazza-roma"],
  "dhl-ab-service": ["dhl-milano", "dhl-roma", "ab-service"],
  "extras-stefania": ["otros"],
};

// null = sin restriccion (todas las areas).
export const allowedAreaKeys = (scopedSections) =>
  scopedSections ? scopedSections.flatMap((section) => SECTION_TO_AREAS[section] ?? []) : null;
