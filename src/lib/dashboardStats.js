import { EN_PROCESO_STATUSES } from "./constants";

const isSameDay = (a, b) => {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // semana arranca el lunes
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const isWithinPeriod = (value, period, now) => {
  const date = new Date(value);
  if (period === "hoy") return isSameDay(date, now);
  if (period === "semana") return date >= startOfWeek(now);
  if (period === "mes") return date >= startOfMonth(now);
  return true;
};

const RECORD_STATUS_KEYS = [
  "IN_SOSPESO",
  "IN_CONSEGNA",
  "CONSEGNATO",
  "RITIRATO",
  "RISCHEDULATO",
  "ANNULLATO",
];

export const computeServiceStats = (records, now = new Date()) => {
  const byEstado = Object.fromEntries(RECORD_STATUS_KEYS.map((key) => [key, 0]));
  records.forEach((record) => {
    if (byEstado[record.estado] !== undefined) byEstado[record.estado] += 1;
  });

  return {
    creadosHoy: records.filter((r) => isSameDay(r.createdAt, now)).length,
    programadosHoy: records.filter((r) => isSameDay(r.fechaServicio, now)).length,
    byEstado,
  };
};

export const computeVehicleStats = (vehicles, records) => {
  const vehiculosEnServicio = new Set(
    records.filter((r) => r.estado === "IN_CONSEGNA").map((r) => r.vehicle?.id)
  );

  return {
    total: vehicles.length,
    disponibles: vehicles.filter((v) => v.estado === "DISPONIBLE").length,
    enMantenimiento: vehicles.filter((v) => v.estado === "EN_MANTENIMIENTO").length,
    fueraDeServicio: vehicles.filter((v) => v.estado === "FUERA_DE_SERVICIO").length,
    enServicioAhora: vehicles.filter((v) => vehiculosEnServicio.has(v.id)).length,
  };
};

export const computeDriverStats = (users, records, now = new Date()) => {
  const choferes = users.filter((u) => u.cargo === "CHOFER");
  const activos = choferes.filter((u) => u.estado === "ACTIVO");

  const conServicioHoyIds = new Set(
    records.filter((r) => isSameDay(r.fechaServicio, now)).map((r) => r.driver?.id)
  );
  const enRutaIds = new Set(
    records.filter((r) => r.estado === "IN_CONSEGNA").map((r) => r.driver?.id)
  );

  return {
    total: choferes.length,
    activos: activos.length,
    conServicioHoy: activos.filter((u) => conServicioHoyIds.has(u.id)).length,
    disponiblesAhora: activos.filter((u) => !enRutaIds.has(u.id)).length,
  };
};

const ECONOMIC_COST_FIELDS = [
  "costoCombustible",
  "peajes",
  "vignetta",
  "costoHotel",
  "costoTraforoFrejusBrennero",
  "areaC",
  "costoEspera",
];

const recordCost = (record) =>
  ECONOMIC_COST_FIELDS.reduce((sum, field) => sum + (record[field] ?? 0), 0);

const recordProfit = (record) => (record.pagoRecibido ?? 0) - recordCost(record);

export const computeEconomicStats = (records, period, now = new Date()) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now));

  const facturacion = scoped.reduce((sum, r) => sum + (r.pagoRecibido ?? 0), 0);
  const costos = scoped.reduce((sum, r) => sum + recordCost(r), 0);
  const ganancia = facturacion - costos;

  const withProfit = scoped
    .map((r) => ({ record: r, profit: recordProfit(r) }))
    .sort((a, b) => b.profit - a.profit);

  const masRentables = withProfit.filter((r) => r.profit > 0).slice(0, 5);
  const conPerdidas = withProfit
    .filter((r) => r.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5);

  return { facturacion, costos, ganancia, masRentables, conPerdidas };
};

export const computeCurrentService = (records, now = new Date()) => {
  const enCurso = records.find((r) => r.estado === "IN_CONSEGNA");
  if (enCurso) return enCurso;

  const proximosHoy = records
    .filter((r) => r.estado === "IN_SOSPESO" && isSameDay(r.fechaServicio, now))
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

  return proximosHoy[0] ?? null;
};

// Todos los servicios en curso o pendientes de accion (IN_CONSEGNA, IN_SOSPESO,
// RITIRATO), para el listado completo de "Servicio actual" del chofer.
export const computeCurrentServices = (records) =>
  records
    .filter((r) => EN_PROCESO_STATUSES.includes(r.estado))
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

export const computeMyServiceCounts = (records, now = new Date()) => ({
  hoy: records.filter((r) => isSameDay(r.fechaServicio, now)).length,
  pendientes: records.filter((r) => EN_PROCESO_STATUSES.includes(r.estado)).length,
  completados: records.filter((r) => r.estado === "CONSEGNATO").length,
  cancelados: records.filter((r) => r.estado === "ANNULLATO").length,
});

export const computeWorkHours = (records, now = new Date()) => {
  const sum = (list, field) => list.reduce((total, r) => total + (r[field] ?? 0), 0);

  const hoy = records.filter((r) => isSameDay(r.fechaServicio, now));
  const semana = records.filter((r) => new Date(r.fechaServicio) >= startOfWeek(now));
  const mes = records.filter((r) => new Date(r.fechaServicio) >= startOfMonth(now));

  return {
    horasHoy: sum(hoy, "horasDia") + sum(hoy, "horasNoche"),
    horasSemana: sum(semana, "horasDia") + sum(semana, "horasNoche"),
    horasMes: sum(mes, "horasDia") + sum(mes, "horasNoche"),
    horasDiaMes: sum(mes, "horasDia"),
    horasNocheMes: sum(mes, "horasNoche"),
    tiempoEsperaMes: sum(mes, "tiempoEspera"),
  };
};

// Servicios en curso o pendientes cuya fecha de servicio ya paso sin cerrarse.
export const computeOverdueServices = (records, now = new Date()) =>
  records.filter(
    (r) =>
      (r.estado === "IN_CONSEGNA" || r.estado === "IN_SOSPESO") &&
      new Date(r.fechaServicio) < now
  );
