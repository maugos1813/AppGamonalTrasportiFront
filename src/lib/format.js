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

export const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Suma minutos a una fecha y devuelve la hora formateada (hh:mm), para mostrar una
// hora estimada de llegada a partir de una fecha base + duracion de ruta.
export const addMinutes = (value, minutes) => {
  if (!value || minutes == null) return "-";
  const date = new Date(new Date(value).getTime() + minutes * 60000);
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
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

// Convierte un ISO date a "yyyy-MM-dd" para <input type="date">.
export const toDateInputValue = (value) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};
