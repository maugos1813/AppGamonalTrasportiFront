export const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Fecha larga en espanol, para encabezados de grupo (ej: "Martes, 14 de julio de 2026").
export const formatDateLong = (value) => {
  if (!value) return "-";
  const text = new Date(value).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// hour12: false fuerza reloj 24h - sin esto, "es-AR" en algunos motores/OS igual
// devuelve "05:00 p. m." en vez de "17:00", justo la ambiguedad que se quiere evitar
// (ver tambien toRomeParts/fromRomeParts en el backend para el mismo criterio del
// lado de la sincronizacion con AppSheet).
export const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// Suma minutos a una fecha y devuelve la hora formateada (hh:mm), para mostrar una
// hora estimada de llegada a partir de una fecha base + duracion de ruta.
export const addMinutes = (value, minutes) => {
  if (!value || minutes == null) return "-";
  const date = new Date(new Date(value).getTime() + minutes * 60000);
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
};

// Cuenta regresiva hasta una fecha limite (ej: la ETA de un servicio). Devuelve
// "Vencido hace Xh Ym" si ya paso, o "Xh Ym restantes" si todavia falta.
export const formatTimeRemaining = (value) => {
  if (!value) return "-";
  const diffMs = new Date(value).getTime() - Date.now();
  const overdue = diffMs < 0;
  const totalMin = Math.round(Math.abs(diffMs) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const text = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return overdue ? `Vencido hace ${text}` : `${text} restantes`;
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);

export const formatKm = (value) => `${Math.round(value ?? 0).toLocaleString("es-AR")} km`;

// Sin decimales, para espacios chicos (ej. el centro de un anillo de progreso).
export const formatCurrencyCompact = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

// Convierte un ISO datetime a "yyyy-MM-ddThh:mm" para <input type="datetime-local">.
export const toDateTimeInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Igual, pero con la hora de pared de Roma (la operacion es ahi) sin importar la zona del
// navegador: para campos que el backend interpreta como hora de Roma (ej. Fecha retiro).
export const toRomeDateTimeInputValue = (value) => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

// "12/10/2026 08:40" en hora de Roma.
export const formatRomeDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// Convierte un ISO date a "yyyy-MM-dd" para <input type="date">.
export const toDateInputValue = (value) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

// Fechas "puras" (sin hora, ej. fecha de nacimiento, vencimientos) llegan del backend como
// medianoche UTC: formatearlas en la hora local las corre un dia para quien este al oeste
// de UTC (ej. Argentina muestra el 23 en vez del 24), asi que se formatean en UTC.
export const formatDateOnly = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
