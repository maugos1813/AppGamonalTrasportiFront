import { EN_PROCESO_STATUSES } from "./constants";
import { desdeCorte } from "./fechasCorte";
import { needsHours } from "./horas";

// Servicios del chofer que todavia le piden algo: terminarlos, cargar las horas de manejo, o declarar los peajes
// de ida/vuelta y el carburante. Es lo que se muestra como "pendiente" en su dashboard y en Mis servicios.
const DAY_MS = 24 * 60 * 60 * 1000;
// Las horas de servicios mas viejos que esto no se recuerdan aca (se ven en Mis horas).
export const PENDING_HOURS_DAYS = 14;

export const PENDING_LABELS = {
  terminar: "Terminar servicio",
  horas: "Horas de manejo",
  corregir: "Corregir horas",
  ida: "Peaje de ida",
  vuelta: "Peaje de vuelta",
  combustible: "Carburante",
};
const FALTANTE_KEYS = ["ida", "vuelta", "combustible"];

// [{ key, label }] de lo que falta en un servicio; vacio = al dia.
export const pendingItems = (record, now = Date.now()) => {
  if (!record || record.estado === "ANNULLATO" || record.estado === "RISCHEDULATO") return [];
  // Los servicios de antes del corte no generan pendientes.
  if (!desdeCorte(record.fechaServicio)) return [];
  // Viaje compacto: lo pendiente de todo el viaje lo lleva el servicio principal.
  if (record.compactado && !record.compactado.principal) return [];
  const items = [];

  if (EN_PROCESO_STATUSES.includes(record.estado)) {
    items.push({ key: "terminar", label: record.compactado ? "Terminar viaje" : PENDING_LABELS.terminar });
  } else if (needsHours(record) && new Date(record.fechaServicio).getTime() >= now - PENDING_HOURS_DAYS * DAY_MS) {
    const key = record.jornada?.estado === "DEVUELTAS" ? "corregir" : "horas";
    items.push({ key, label: PENDING_LABELS[key] });
  }

  for (const key of FALTANTE_KEYS) {
    if (record.faltantes?.pendientes && record.faltantes[key]) items.push({ key, label: PENDING_LABELS[key] });
  }
  return items;
};

export const isPending = (record) => pendingItems(record).length > 0;

// Que boton principal lleva un servicio pendiente: terminarlo, cargar las horas (los dos abren el mismo
// formulario) o ir al detalle a declarar peajes/carburante.
export const primaryAction = (items) => {
  if (items.some((i) => i.key === "terminar")) return "terminar";
  if (items.some((i) => i.key === "horas" || i.key === "corregir")) return "horas";
  return items.length > 0 ? "detalle" : null;
};

// En proceso primero (por fecha), despues los terminados con faltas, del mas nuevo al mas viejo.
export const sortPending = (a, b) => {
  const aOpen = EN_PROCESO_STATUSES.includes(a.estado);
  const bOpen = EN_PROCESO_STATUSES.includes(b.estado);
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  const diff = new Date(a.fechaServicio) - new Date(b.fechaServicio);
  return aOpen ? diff : -diff;
};
