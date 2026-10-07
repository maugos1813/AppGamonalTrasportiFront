// Mes en curso de Roma como "AAAA-MM" (el mismo criterio que usa el backend).
export const currentMonth = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }).slice(0, 7);

export const shiftMonth = (month, delta) => {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export const monthName = (month) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

// Colores de las tres series del grafico de gasto mensual (y de sus tarjetas).
export const COSTO_COLORS = {
  pagoChoferes: "#a78bfa",
  gastosServicios: "#ff8a1a",
  combustible: "#22e093",
};

const KM_SOURCE_LABELS = { REAL: "km reales", SERVICIO: "km del servicio", RUTA: "km de la ruta", SIN_DATO: "sin km" };
export const kmSourceLabel = (source) => KM_SOURCE_LABELS[source] ?? "";

const nf = (value) => Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 });

// Texto de como se calculo el pago de un servicio: "147 km x 10 EUR/100 km", "3,5 h x 10 EUR"...
export const payCalcText = (item, reglas) => {
  const parts = [];
  if (item.modo === "HORAS") parts.push(`${nf(item.horas)} h x ${nf(reglas.horaEur)} EUR`);
  else if (item.kmFuente === "SIN_DATO") parts.push("sin kilometros cargados");
  else parts.push(`${nf(item.km)} km x ${nf(reglas.cada100KmEur)} EUR/100 km`);
  if (item.esperaHoras > 0) parts.push(`+ ${nf(item.esperaHoras)} h de espera x ${nf(reglas.esperaHoraEur)} EUR`);
  return parts.join(" ");
};
