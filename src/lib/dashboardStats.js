import { EN_PROCESO_STATUSES, TIPO_DOCUMENTO_LABELS, getTagliandoStatus } from "./constants";
import { formatDate } from "./format";

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

// Rango del periodo inmediatamente anterior al seleccionado (mismo largo), para
// poder mostrar "+X% vs periodo anterior" en los KPI economicos.
const isWithinPreviousPeriod = (value, period, now) => {
  const date = new Date(value);
  if (period === "hoy") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(date, yesterday);
  }
  if (period === "semana") {
    const start = startOfWeek(now);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    return date >= prevStart && date < start;
  }
  if (period === "mes") {
    const start = startOfMonth(now);
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    return date >= prevStart && date < start;
  }
  return false;
};

// null cuando no hay base de comparacion (evita mostrar "+Infinity%").
const percentChange = (current, previous) => {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
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

// DHL/AB Service no carga costos manuales: se paga un monto fijo por KM (ida y
// vuelta, de ahi el x2) en vez de sumar combustible/peajes/etc. Area C y espera
// siguen siendo manuales para DHL tambien (no entran en la tarifa por KM).
export const isDhlAbRecord = (record) => record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE";

// Tarifa de referencia para estimar lo facturado (rimborso km estandar).
const DHL_KM_RATE = 0.43;
const DHL_KM_MULTIPLIER = 2;

// Pago al chofer: 10€/hora de manejo, sea cual sea el tipo de servicio.
const DRIVER_HOURLY_RATE = 10;
// Si no hay horasDia/horasNoche cargadas (servicios importados, o uno recien
// creado antes de que el chofer cierre el servicio), se estima la hora manejada a
// un promedio de ~100km/hora en vez de dejar el pago al chofer en 0 por falta de
// dato. Sin duplicar por ida/vuelta aca: el KM cargado en el registro ya es el
// total recorrido (a diferencia de la tarifa de DHL, que si duplica el KM
// planificado porque ese es de un solo tramo).
const ASSUMED_KM_PER_HOUR = 100;

const dhlKmCharge = (record, rate) => (record.kilometros ?? 0) * DHL_KM_MULTIPLIER * rate;
const dhlExtras = (record) => (record.areaC ?? 0) + (record.costoEspera ?? 0);

// Horas manejadas: las reales si el chofer ya las cargo; si no, se estiman a
// partir del KM total del registro (sin duplicar, ver ASSUMED_KM_PER_HOUR).
const recordDriverHours = (record) => {
  const logged = (record.horasDia ?? 0) + (record.horasNoche ?? 0);
  if (logged > 0) return logged;
  return (record.kilometros ?? 0) / ASSUMED_KM_PER_HOUR;
};

const recordDriverPay = (record) => recordDriverHours(record) * DRIVER_HOURLY_RATE;

// "Costos operativos": combustible/peajes/etc (Extras Piazza) o el monto fijo por
// KM (DHL/AB Service, que no carga esos gastos manualmente), mas en ambos casos el
// pago al chofer - antes solo se contaban los gastos del vehiculo, sin el costo real
// de la mano de obra.
const recordCost = (record) =>
  recordDriverPay(record) +
  (isDhlAbRecord(record)
    ? dhlExtras(record)
    : ECONOMIC_COST_FIELDS.reduce((sum, field) => sum + (record[field] ?? 0), 0));

// DHL/AB Service tampoco carga facturacion manualmente todavia: mientras no se
// cargue un pagoRecibido real, se estima con la tarifa de referencia por KM. El dia
// que se cargue el pago real de un servicio puntual, ese valor pisa la estimacion.
const recordRevenue = (record) => {
  if (record.pagoRecibido != null) return record.pagoRecibido;
  if (isDhlAbRecord(record)) return dhlKmCharge(record, DHL_KM_RATE) + dhlExtras(record);
  return 0;
};

const recordProfit = (record) => recordRevenue(record) - recordCost(record);

export const computeEconomicStats = (records, period, now = new Date()) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now));
  const previousScoped = records.filter((r) => isWithinPreviousPeriod(r.fechaServicio, period, now));

  const facturacion = scoped.reduce((sum, r) => sum + recordRevenue(r), 0);
  const costos = scoped.reduce((sum, r) => sum + recordCost(r), 0);
  const ganancia = facturacion - costos;

  const facturacionAnterior = previousScoped.reduce((sum, r) => sum + recordRevenue(r), 0);
  const gananciaAnterior =
    facturacionAnterior - previousScoped.reduce((sum, r) => sum + recordCost(r), 0);

  const withProfit = scoped
    .map((r) => ({ record: r, profit: recordProfit(r) }))
    .sort((a, b) => b.profit - a.profit);

  const masRentables = withProfit.filter((r) => r.profit > 0).slice(0, 5);
  const conPerdidas = withProfit
    .filter((r) => r.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5);

  return {
    facturacion,
    costos,
    ganancia,
    masRentables,
    conPerdidas,
    facturacionDeltaPct: percentChange(facturacion, facturacionAnterior),
    gananciaDeltaPct: percentChange(ganancia, gananciaAnterior),
  };
};

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Facturacion y ganancia mes a mes del anio en curso (Ene-Dic), para el grafico de
// tendencia del dashboard OWNER. A diferencia de computeEconomicStats (que solo mira
// el periodo elegido en el selector), esto siempre es el anio calendario completo.
export const computeMonthlyRevenueTrend = (records, now = new Date()) => {
  const year = now.getFullYear();
  const buckets = MONTH_LABELS.map((month) => ({ month, facturacion: 0, ganancia: 0 }));

  records.forEach((r) => {
    const date = new Date(r.fechaServicio);
    if (date.getFullYear() !== year) return;
    const bucket = buckets[date.getMonth()];
    bucket.facturacion += recordRevenue(r);
    bucket.ganancia += recordProfit(r);
  });

  return buckets;
};

const OTROS_LABEL = "Otros";
const MAX_CLIENT_SLICES = 4;

// Distribucion de facturacion por cliente en el periodo, para el grafico de
// torta del dashboard OWNER. Agrupa todo lo que no entra en el top N como "Otros".
export const computeClientDistribution = (records, period, now = new Date()) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now));

  const totalsByClient = new Map();
  scoped.forEach((r) => {
    const name = r.client?.nombre ?? "Sin cliente";
    const amount = recordRevenue(r);
    totalsByClient.set(name, (totalsByClient.get(name) ?? 0) + amount);
  });

  const sorted = Array.from(totalsByClient.entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  const top = sorted.slice(0, MAX_CLIENT_SLICES);
  const rest = sorted.slice(MAX_CLIENT_SLICES);
  const otrosTotal = rest.reduce((sum, [, value]) => sum + value, 0);

  const entries = otrosTotal > 0 ? [...top, [OTROS_LABEL, otrosTotal]] : top;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return entries.map(([name, value]) => ({
    name,
    value,
    percent: total > 0 ? (value / total) * 100 : 0,
  }));
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

// DHL/AB Service pesan el doble que Extras Piazza en los rankings de KM (mas
// exigentes para el chofer/vehiculo que un trayecto de Extras Piazza equivalente).
// Pedido explicito del negocio, no una medida real de distancia recorrida.
const kmMultiplier = (record) =>
  record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE" ? 2 : 1;

// Km reales si el chofer ya los cargo, si no los planificados - asi un servicio
// recien creado no queda en cero solo porque todavia no se cerro.
const recordKm = (record) => (record.kilometrosReales ?? record.kilometros ?? 0) * kmMultiplier(record);

// Categoria "cruda" (sin el peso x2) por spedizzione, para poder mostrar el
// desglose en el modal de detalle - un registro sin spedizzione reconocido se
// trata como Extras Piazza (mismo criterio que kmMultiplier).
const kmCategory = (record) =>
  record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE" ? record.spedizzione : "EXTRA_PIAZZA";

export const computeDriverKmRanking = (records, period, now = new Date()) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now));
  const totals = new Map();

  scoped.forEach((r) => {
    if (!r.driver?.id) return;
    const entry = totals.get(r.driver.id) ?? {
      id: r.driver.id,
      nombre: `${r.driver.nombre} ${r.driver.apellido}`,
      km: 0,
      servicios: 0,
      breakdown: { EXTRA_PIAZZA: 0, DHL: 0, AB_SERVICE: 0 },
    };
    entry.km += recordKm(r);
    entry.servicios += 1;
    entry.breakdown[kmCategory(r)] += r.kilometrosReales ?? r.kilometros ?? 0;
    totals.set(r.driver.id, entry);
  });

  return Array.from(totals.values()).sort((a, b) => b.km - a.km);
};

export const computeFleetKmUsage = (records, period, now = new Date()) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now));
  const totals = new Map();

  scoped.forEach((r) => {
    if (!r.vehicle?.id) return;
    const entry = totals.get(r.vehicle.id) ?? {
      id: r.vehicle.id,
      nombre: `${r.vehicle.targa}${r.vehicle.modelo ? ` - ${r.vehicle.modelo}` : ""}`,
      km: 0,
      servicios: 0,
    };
    entry.km += recordKm(r);
    entry.servicios += 1;
    totals.set(r.vehicle.id, entry);
  });

  return Array.from(totals.values()).sort((a, b) => b.km - a.km);
};

// Servicios en curso o pendientes cuya fecha de servicio ya paso sin cerrarse.
export const computeOverdueServices = (records, now = new Date()) =>
  records.filter(
    (r) =>
      (r.estado === "IN_CONSEGNA" || r.estado === "IN_SOSPESO") &&
      new Date(r.fechaServicio) < now
  );

// --- Notificaciones OWNER/ADMIN (campanita) ---------------------------------

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const DOCUMENT_WARNING_DAYS = 30;
const BIRTHDAY_WARNING_DAYS = 7;

const daysUntil = (dateValue, now) => (new Date(dateValue).getTime() - now.getTime()) / DAY_MS;

// Documentos de choferes (no OWNER/ADMIN) que vencen dentro de 30 dias, o ya vencidos.
export const computeDriverDocumentAlerts = (documents, users, now = new Date()) => {
  const choferIds = new Set(users.filter((u) => u.cargo === "CHOFER").map((u) => u.id));

  return documents
    .filter((d) => d.fechaScadenza && choferIds.has(d.usuarioId))
    .filter((d) => daysUntil(d.fechaScadenza, now) <= DOCUMENT_WARNING_DAYS)
    .sort((a, b) => new Date(a.fechaScadenza) - new Date(b.fechaScadenza))
    .map((d) => {
      const user = users.find((u) => u.id === d.usuarioId);
      const nombre = user ? `${user.nombre} ${user.apellido}` : "un chofer";
      const tipo = TIPO_DOCUMENTO_LABELS[d.tipoDocumento] ?? d.tipoDocumento;
      return {
        id: `driver-doc-${d.id}`,
        severity: "warning",
        message: `${tipo} de ${nombre} vence el ${formatDate(d.fechaScadenza)}`,
        link: `/choferes/${d.usuarioId}`,
        date: d.fechaScadenza,
      };
    });
};

// Poliza de seguro y revision tecnica de cada vehiculo, mismo umbral de 30 dias.
export const computeVehicleDocumentAlerts = (vehicles, now = new Date()) => {
  const alerts = [];

  vehicles.forEach((v) => {
    if (v.poliza && daysUntil(v.poliza, now) <= DOCUMENT_WARNING_DAYS) {
      alerts.push({
        id: `vehicle-poliza-${v.id}`,
        severity: "warning",
        message: `Poliza de seguro de ${v.targa} vence el ${formatDate(v.poliza)}`,
        link: `/vehiculos/${v.id}`,
        date: v.poliza,
      });
    }
    if (v.rTecnica && daysUntil(v.rTecnica, now) <= DOCUMENT_WARNING_DAYS) {
      alerts.push({
        id: `vehicle-rtecnica-${v.id}`,
        severity: "warning",
        message: `Revision tecnica de ${v.targa} vence el ${formatDate(v.rTecnica)}`,
        link: `/vehiculos/${v.id}`,
        date: v.rTecnica,
      });
    }
  });

  return alerts.sort((a, b) => new Date(a.date) - new Date(b.date));
};

// Estado de Tagliando de un vehiculo puntual (mismos umbrales que la seccion Mecanica).
// Se expone aparte del listado para el aviso individual del chofer sobre "su" vehiculo.
// withLink=false para el chofer: la seccion Mecanica es solo OWNER/ADMIN, asi que no
// tiene sentido darle un link que lo termine mandando de vuelta al inicio.
export const getVehicleMaintenanceAlert = (vehicle, { withLink = true } = {}) => {
  const status = getTagliandoStatus(vehicle.kmUltimoMantenimiento, vehicle.kmActual);
  if (!status || status.level === "ok") return null;

  return {
    id: `vehicle-tagliando-${vehicle.id}`,
    severity: status.level === "urgente" ? "urgent" : "warning",
    message:
      status.level === "urgente"
        ? `${vehicle.targa} ya paso el km de Tagliando (${Math.round(status.usado).toLocaleString("es-AR")} km desde el ultimo mantenimiento).`
        : `${vehicle.targa} esta cerca del Tagliando: quedan ${Math.round(status.restante).toLocaleString("es-AR")} km.`,
    ...(withLink ? { link: "/mecanica" } : {}),
  };
};

// Aviso de Tagliando de toda la flota, para la campanita OWNER/ADMIN (urgentes primero).
export const computeVehicleMaintenanceAlerts = (vehicles) =>
  vehicles
    .map(getVehicleMaintenanceAlert)
    .filter(Boolean)
    .sort((a, b) => (a.severity === "urgent" ? -1 : b.severity === "urgent" ? 1 : 0));

// Choferes activos cuyo celular reporto que el permiso de ubicacion en segundo plano
// no esta en "Permitir todo el tiempo" (ver useLocationSharing). Urgente si en este
// momento tienen un servicio "en camino" (no se los puede rastrear ahora mismo),
// si no, queda como aviso para resolverlo antes del proximo servicio.
export const computeLocationPermissionAlerts = (users, records) => {
  const activeDriverIds = new Set(
    records.filter((r) => r.estado === "IN_CONSEGNA").map((r) => r.driver?.id)
  );

  return users
    .filter((u) => u.cargo === "CHOFER" && u.estado === "ACTIVO" && u.ubicacionPermisoDenegado)
    .map((u) => {
      const nombre = `${u.nombre} ${u.apellido}`;
      const isActiveNow = activeDriverIds.has(u.id);
      return {
        id: `location-permission-${u.id}`,
        severity: isActiveNow ? "urgent" : "warning",
        message: isActiveNow
          ? `${nombre} tiene un servicio en camino pero su GPS no comparte en segundo plano.`
          : `${nombre} no tiene el permiso de ubicacion en "Permitir todo el tiempo".`,
        link: `/choferes/${u.id}`,
      };
    });
};

// Proxima fecha en la que cumple anios (este anio si todavia no paso, si no el que viene).
const nextBirthday = (fechaNacimiento, now) => {
  const birth = new Date(fechaNacimiento);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(now.getFullYear(), birth.getUTCMonth(), birth.getUTCDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return next;
};

// Cumpleanios de cualquier usuario (chofer, admin u owner) dentro de los proximos 7 dias.
export const computeBirthdayAlerts = (users, now = new Date()) =>
  users
    .filter((u) => u.fechaNacimiento)
    .map((u) => ({ user: u, next: nextBirthday(u.fechaNacimiento, now) }))
    .filter(({ next }) => (next.getTime() - now.getTime()) / DAY_MS <= BIRTHDAY_WARNING_DAYS)
    .sort((a, b) => a.next - b.next)
    .map(({ user, next }) => ({
      id: `birthday-${user.id}`,
      severity: "reminder",
      message: isSameDay(next, now)
        ? `Hoy es el cumpleanios de ${user.nombre} ${user.apellido}`
        : `${user.nombre} ${user.apellido} cumple anios el ${formatDate(next)}`,
      link: user.cargo === "CHOFER" ? `/choferes/${user.id}` : undefined,
      date: next,
    }));
