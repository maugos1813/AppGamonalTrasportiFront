export const PARADA_CLASES = {
  A_REVISAR: { label: "A revisar", pill: "bg-warning-500/20 text-warning-500", hint: "Larga y lejos de las paradas del servicio" },
  SERVICIO: { label: "Servicio", pill: "bg-success-500/15 text-success-500", hint: "En una parada del servicio o en el deposito" },
  COMBUSTIBLE: { label: "Combustible", pill: "bg-accent-500/20 text-accent-400", hint: "Coincide con una carga de combustible" },
  TOLERADA: { label: "Tolerada", pill: "bg-line/10 text-ink-300", hint: "Dentro de la tolerancia" },
  EN_CURSO: { label: "En curso", pill: "bg-accent-500/20 text-accent-400", hint: "El vehiculo sigue detenido" },
};

export const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

// Hora de Roma "HH:MM" de un instante.
export const romeHHMM = (value) =>
  new Date(value).toLocaleTimeString("es-AR", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Dia de Roma "AAAA-MM-DD" de un instante.
export const romeDay = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

export const formatDuration = (min) => {
  if (min == null) return "-";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};
