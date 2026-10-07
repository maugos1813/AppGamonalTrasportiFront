// Bandas horarias de pago (hora de Roma): dia 07:00-18:59, noche 19:00-06:59.
// Espejo de DAY_BAND / PAY_RATES en el backend (config/payRates.js); el pago real lo calcula el
// servidor, esto solo alimenta la vista previa mientras el chofer completa el formulario.
export const DAY_START_MIN = 7 * 60;
export const NIGHT_START_MIN = 19 * 60;

export const HORAS_ESTADOS = {
  PENDIENTE: { label: "En revision", pill: "bg-warning-500/20 text-warning-500" },
  APROBADAS: { label: "Aprobadas", pill: "bg-success-500/15 text-success-500" },
  DEVUELTAS: { label: "Devueltas", pill: "bg-danger-500/20 text-danger-500" },
  SIN_CARGAR: { label: "Sin cargar", pill: "bg-line/10 text-ink-300" },
};

export const horasEstadoKey = (estado) => estado ?? "SIN_CARGAR";

// "AAAA-MM-DDTHH:mm" (hora de pared) -> minutos desde una epoca comun. Se toma como UTC a
// proposito: no se quiere ninguna conversion de zona, solo aritmetica sobre el reloj de pared.
const wallToMinutes = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) / 60000;
};

// Vista previa de la jornada: misma logica que utils/workHours.js (lo trabajado se reparte en
// la misma proporcion que la jornada entre dia y noche). Ignora el cambio de hora (2 dias al
// ano); el servidor es quien manda.
export const previewShift = ({ inicio, fin, esperaMin = 0, pausaMin = 0 }, rates) => {
  const start = wallToMinutes(inicio);
  const end = wallToMinutes(fin);
  if (start == null || end == null) return { error: "" };
  if (end <= start) return { error: "La hora de fin debe ser posterior a la de inicio" };
  const total = end - start;
  if (total > 24 * 60) return { error: "La jornada no puede superar las 24 horas, revisa las fechas" };
  const espera = Math.max(0, Number(esperaMin) || 0);
  const pausa = Math.max(0, Number(pausaMin) || 0);
  if (espera + pausa > total) return { error: "La espera y la pausa no pueden superar la jornada" };

  let diaMin = 0;
  for (let t = start; t < end; t += 1) {
    const minuteOfDay = ((t % 1440) + 1440) % 1440;
    if (minuteOfDay >= DAY_START_MIN && minuteOfDay < NIGHT_START_MIN) diaMin += 1;
  }
  const nocheMin = total - diaMin;
  const factor = (total - espera - pausa) / total;
  const horasDia = (diaMin * factor) / 60;
  const horasNoche = (nocheMin * factor) / 60;
  const pago = rates
    ? horasDia * rates.horaDiaEur + horasNoche * rates.horaNocheEur + (espera / 60) * rates.esperaHoraEur
    : null;
  return { error: "", totalMin: total, horasDia, horasNoche, esperaHoras: espera / 60, pago };
};

// Horas con un decimal y coma: 1,5 h.
export const formatHours = (value) =>
  `${Number(value ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })} h`;

// Un servicio entregado/retirado al que el chofer todavia tiene que cargarle horas.
export const needsHours = (record) =>
  ["CONSEGNATO", "RITIRATO"].includes(record.estado) &&
  (!record.jornada?.estado || record.jornada.estado === "DEVUELTAS");
