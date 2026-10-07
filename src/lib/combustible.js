// Areas a las que se imputa una carga de combustible. Los colores son los mismos del
// resto de la app (Registros/Dashboard) para que cada area se reconozca igual en todos
// lados; Farmacia no tiene uno propio todavia.
export const COMBUSTIBLE_AREAS = [
  { value: "DHL_MILANO", label: "DHL Milano", color: "#facc15", fg: "#1a1400" },
  { value: "DHL_ROMA", label: "DHL Roma", color: "#fde68a", fg: "#1a1400" },
  { value: "EXTRAS_PIAZZA_MILANO", label: "Extras Piazza Milano", color: "#94a3b8", fg: "#0b1220" },
  { value: "EXTRAS_PIAZZA_ROMA", label: "Extras Piazza Roma", color: "#64748b", fg: "#ffffff" },
  { value: "AB_SERVICE", label: "AB Service", color: "#2f8dff", fg: "#ffffff" },
  { value: "FARMACIA", label: "Farmacia", color: "#22e093", fg: "#04140c" },
];

export const COMBUSTIBLE_AREA_BY_VALUE = Object.fromEntries(COMBUSTIBLE_AREAS.map((a) => [a.value, a]));

export const AREA_OPTIONS = COMBUSTIBLE_AREAS.map((a) => ({ value: a.value, label: a.label }));

// Ultima area y gasolinera que uso el chofer: casi siempre carga en el mismo lugar y para
// la misma area, asi el formulario le llega ya completado. Solo una comodidad: si el
// navegador no deja guardar (modo privado, etc.) simplemente no se recuerda.
const LAST_USED_KEY = "combustible:last-used";

export const readLastUsed = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_USED_KEY) ?? "{}");
    return {
      area: COMBUSTIBLE_AREA_BY_VALUE[parsed.area] ? parsed.area : "",
      metodo: typeof parsed.metodo === "string" ? parsed.metodo : "",
    };
  } catch {
    return { area: "", metodo: "" };
  }
};

export const saveLastUsed = ({ area, metodo }) => {
  try {
    localStorage.setItem(LAST_USED_KEY, JSON.stringify({ area, metodo }));
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
};

// A que servicio se imputa cada carga (lo calcula el backend; ver combustibleMatching.service.js).
// "Esperando servicio" no vence: se asigna sola cuando se carga un servicio que encaje.
export const COMBUSTIBLE_ASIGNACIONES = {
  AUTO: { label: "Asignada", pill: "bg-success-500/15 text-success-500", tone: "text-success-500" },
  CONFIRMADO: { label: "Confirmada", pill: "bg-success-500/15 text-success-500", tone: "text-success-500" },
  MANUAL: { label: "Asignada a mano", pill: "bg-success-500/15 text-success-500", tone: "text-success-500" },
  SUGERIDO: { label: "Por confirmar", pill: "bg-warning-500/20 text-warning-500", tone: "text-warning-500" },
  EN_ESPERA: { label: "Esperando servicio", pill: "bg-accent-500/20 text-accent-300", tone: "text-accent-300" },
};

export const COMBUSTIBLE_ASIGNACION_FILTER_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "REVISAR", label: "Por revisar" },
  { value: "SUGERIDO", label: "Por confirmar" },
  { value: "EN_ESPERA", label: "Esperando servicio" },
];

// Hora actual de Roma ("HH:MM"): valor por defecto de la hora de la carga.
export const romeNowHHMM = () =>
  new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
