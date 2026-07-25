import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SEVERITY_DOT_CLASSES, SEVERITY_ITEM_CLASSES } from "../../components/layout/NotificationsBell";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { ProgressRing } from "../../components/ui/ProgressRing";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TextField } from "../../components/ui/TextField";
import { ServicesTrendChart } from "../../components/charts/ServicesTrendChart";
import { ServicesWeekBarChart } from "../../components/charts/ServicesWeekBarChart";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationsContext";
import { parseApiError } from "../../lib/api";
import {
  computeDriverKmRanking,
  computeDriverStats,
  computeEconomicStats,
  computeExtrasPiazzaZonaBreakdown,
  computeFleetKmUsage,
  computeServicePeriodStats,
  computeVehicleStats,
  computeWeeklyServiceTrend,
} from "../../lib/dashboardStats";
import { formatCurrency, formatDate } from "../../lib/format";
import { listRecordsRequest, searchRecordsRequest } from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

// Misma fuente que useNotifications (ver dashboardStats.js): cada alerta arma su id con
// un prefijo por tipo de origen. Se usa solo para agrupar visualmente aca, no cambia la
// logica de que alertas existen (esa sigue siendo la unica fuente de verdad).
const CATEGORY_RULES = [
  { prefix: "driver-doc-", label: "Documentos de choferes" },
  { prefix: "vehicle-poliza-", label: "Documentos de vehiculos" },
  { prefix: "vehicle-rtecnica-", label: "Documentos de vehiculos" },
  { prefix: "vehicle-tagliando-", label: "Mantenimiento (Tagliando)" },
  { prefix: "location-permission-", label: "Ubicacion GPS" },
  { prefix: "birthday-", label: "Cumpleanios" },
  { prefix: "overdue-", label: "Servicios vencidos" },
  { prefix: "maintenance-", label: "Vehiculo en mantenimiento" },
  { prefix: "evidence-", label: "Evidencia faltante" },
];
const OTHER_LABEL = "Otros";
const CATEGORY_ORDER = [...CATEGORY_RULES.map((r) => r.label), OTHER_LABEL].filter(
  (label, idx, arr) => arr.indexOf(label) === idx
);

const categoryFor = (alert) => CATEGORY_RULES.find((r) => alert.id.startsWith(r.prefix))?.label ?? OTHER_LABEL;

const groupAlerts = (alerts) => {
  const byLabel = new Map();
  alerts.forEach((alert) => {
    const label = categoryFor(alert);
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(alert);
  });
  return CATEGORY_ORDER.map((label) => ({ label, items: byLabel.get(label) ?? [] })).filter(
    (group) => group.items.length > 0
  );
};

const todayLabel = () =>
  new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

const TAB_OPTIONS = [
  { value: "general", label: "General" },
  { value: "diario", label: "Diario" },
  { value: "semanal", label: "Semanal" },
];

const fmtKm = (km) => Math.round(km).toLocaleString("es-AR");

// Ranking de choferes o vehiculos por KM esta semana (computeDriverKmRanking /
// computeFleetKmUsage), mas quien de la lista activa no aparece en el ranking - no
// tuvo ningun servicio esta semana.
const RankingCard = ({ title, subtitle, entries, emptyLabel, inactiveLabel, inactiveNames }) => (
  <GlassCard>
    <h2 className="text-[15px] font-semibold text-ink-50">{title}</h2>
    <p className="mt-1 text-[12px] text-ink-400">{subtitle}</p>

    {entries.length === 0 ? (
      <p className="mt-3 text-[13px] text-ink-300">{emptyLabel}</p>
    ) : (
      <ul className="mt-3 flex flex-col gap-1.5">
        {entries.map((entry, idx) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 rounded-xl glass-surface-sm px-3 py-2 text-[13px]"
          >
            <span className="w-4 shrink-0 text-center text-[12px] font-medium text-ink-400">{idx + 1}</span>
            <span className="min-w-0 flex-1 truncate text-ink-50">{entry.nombre}</span>
            <span className="shrink-0 text-[12px] text-ink-300">
              {fmtKm(entry.km)} km &middot; {entry.servicios} serv.
            </span>
          </li>
        ))}
      </ul>
    )}

    {inactiveNames.length > 0 && (
      <div className="mt-3 rounded-xl border border-status-rischedulato/25 bg-status-rischedulato/5 px-3 py-2.5">
        <p className="text-[12px] font-medium text-status-rischedulato">{inactiveLabel}</p>
        <p className="mt-1 text-[12px] text-ink-300">{inactiveNames.join(", ")}</p>
      </div>
    )}
  </GlassCard>
);

// Mismo patron que RankedList de OwnerDashboardPage (servicios mas rentables / con
// perdidas), version chica local para no acoplar esta pagina con esa.
const ProfitLossList = ({ title, items, tone }) => (
  <div>
    <h3 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-ink-400">{title}</h3>
    {items.length === 0 ? (
      <p className="text-[13px] text-ink-300">Sin datos esta semana.</p>
    ) : (
      <ul className="flex flex-col gap-2">
        {items.map(({ record, profit }) => (
          <li key={record.id}>
            <Link
              to={`/records/${record.id}`}
              className="flex items-center justify-between gap-3 rounded-xl glass-surface-sm px-4 py-2.5 text-[13px] hover:bg-line/10"
            >
              <span className="min-w-0 truncate text-ink-50">
                {record.codigo} - {record.destinazione}
              </span>
              <span className={clsx("shrink-0", tone === "green" ? "text-success-500" : "text-danger-500")}>
                {formatCurrency(profit)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const DailySummaryPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const { alerts, loading } = useNotifications();
  const groups = useMemo(() => groupAlerts(alerts), [alerts]);

  const [tab, setTab] = useState(isPrivileged ? "general" : "diario");

  // Pestanias "General" y "Semanal" (solo OWNER/ADMIN) comparten estos 3 fetches: se
  // cargan recien la primera vez que se entra a cualquiera de las dos, no en cada
  // visita a "Resumen diario", y no se repiten al alternar entre General y Semanal.
  // drivers/vehicles se guardan sin filtrar por estado: computeDriverStats/
  // computeVehicleStats (pestania General) necesitan el universo completo para sus
  // propios conteos (activos, disponibles, etc.) - el filtro de "activo"/"en
  // servicio" que solo necesita la pestania Semanal se aplica en el punto de uso.
  const [records, setRecords] = useState(null);
  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [weeklyError, setWeeklyError] = useState("");

  useEffect(() => {
    if (!isPrivileged || (tab !== "general" && tab !== "semanal") || records !== null) return;
    let cancelled = false;

    // General/Semanal solo necesitan hoy/esta semana - pedir todo el historico (miles
    // de registros, ~2.7MB) para despues filtrar en el navegador era el cuello de
    // botella real de esta pagina.
    listRecordsRequest({ days: 7 })
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setWeeklyError(parseApiError(err).message);
      });
    listUsersRequest()
      .then((data) => {
        if (!cancelled) setDrivers(data.filter((u) => u.cargo === "CHOFER"));
      })
      .catch((err) => {
        if (!cancelled) setWeeklyError(parseApiError(err).message);
      });
    listVehiclesRequest()
      .then((data) => {
        if (!cancelled) setVehicles(data);
      })
      .catch((err) => {
        if (!cancelled) setWeeklyError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, tab, records]);

  const weeklyLoaded = Boolean(records && drivers && vehicles);

  const driverRanking = useMemo(() => (records ? computeDriverKmRanking(records, "semana") : []), [records]);
  const fleetRanking = useMemo(() => (records ? computeFleetKmUsage(records, "semana") : []), [records]);
  const zonaBreakdown = useMemo(
    () => (records ? computeExtrasPiazzaZonaBreakdown(records, "semana") : []),
    [records]
  );
  const economicStats = useMemo(() => (records ? computeEconomicStats(records, "semana") : null), [records]);

  const inactiveDriverNames = useMemo(() => {
    if (!drivers) return [];
    const activeIds = new Set(driverRanking.map((e) => e.id));
    return drivers
      .filter((d) => d.estado === "ACTIVO" && !activeIds.has(d.id))
      .map((d) => `${d.nombre} ${d.apellido}`);
  }, [drivers, driverRanking]);

  const inactiveVehicleNames = useMemo(() => {
    if (!vehicles) return [];
    const activeIds = new Set(fleetRanking.map((e) => e.id));
    return vehicles
      .filter((v) => v.estado !== "FUERA_DE_SERVICIO" && !activeIds.has(v.id))
      .map((v) => `${v.targa}${v.modelo ? ` - ${v.modelo}` : ""}`);
  }, [vehicles, fleetRanking]);

  const servicePeriodStats = useMemo(
    () => (records ? computeServicePeriodStats(records, "hoy") : null),
    [records]
  );
  const driverStats = useMemo(
    () => (records && drivers ? computeDriverStats(drivers, records) : null),
    [drivers, records]
  );
  const vehicleStats = useMemo(
    () => (records && vehicles ? computeVehicleStats(vehicles, records) : null),
    [vehicles, records]
  );
  const recentRecords = useMemo(
    () => (records ? [...records].sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio)).slice(0, 6) : []),
    [records]
  );
  const weeklyServiceTrend = useMemo(() => (records ? computeWeeklyServiceTrend(records) : []), [records]);

  // Acceso rapido (todas las pestanias): buscar un servicio sin tener que ir a
  // Registros primero. Mismo debounce/umbral de 2 caracteres que el buscador de
  // RecordsListPage.jsx.
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [quickSearchResults, setQuickSearchResults] = useState(null);

  useEffect(() => {
    if (!isPrivileged) return;
    const query = quickSearchQuery.trim();
    if (query.length < 2) {
      setQuickSearchResults(null);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      searchRecordsRequest(query)
        .then((data) => {
          if (!cancelled) setQuickSearchResults(data.slice(0, 6));
        })
        .catch(() => {
          if (!cancelled) setQuickSearchResults([]);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isPrivileged, quickSearchQuery]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold capitalize text-ink-50">
            {tab === "general" ? "Resumen general" : tab === "diario" ? "Resumen diario" : "Resumen semanal"}
          </h1>
          <p className="mt-1 text-[14px] text-ink-300">
            {tab === "general"
              ? "La operacion de hoy, de un vistazo."
              : tab === "diario"
                ? `${todayLabel()} · todo lo que necesita tu atencion, en un solo lugar.`
                : "Patrones de la semana: quien rindio mas o menos, y que servicios dieron perdida."}
          </p>
        </div>
        {isPrivileged && <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />}
      </div>

      {isPrivileged && (
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/records/extras-piazza/new" className="w-auto shrink-0">
            <Button className="w-auto px-5">Nuevo servicio Extras Piazza</Button>
          </Link>

          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <TextField
              id="resumen-quick-search"
              placeholder="Buscar por codigo, cliente o chofer..."
              value={quickSearchQuery}
              onChange={(e) => setQuickSearchQuery(e.target.value)}
            />
            {quickSearchResults !== null && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl glass-surface p-2">
                {quickSearchResults.length === 0 ? (
                  <p className="px-3 py-2 text-[13px] text-ink-300">Sin resultados.</p>
                ) : (
                  quickSearchResults.map((record) => (
                    <Link
                      key={record.id}
                      to={`/records/${record.id}`}
                      onClick={() => setQuickSearchQuery("")}
                      className="block rounded-lg px-3 py-2 text-[13px] text-ink-100 hover:bg-line/10"
                    >
                      <span className="font-medium text-ink-50">{record.codigo}</span> - {record.destinazione}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "general" && isPrivileged && (
        <>
          <Alert>{weeklyError}</Alert>

          {!weeklyLoaded && (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6 border-line/20 border-t-line" />
            </div>
          )}

          {weeklyLoaded && (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
                <GlassCard>
                  <h2 className="text-[15px] font-semibold text-ink-50">Servicios esta semana</h2>
                  <p className="mt-1 text-[12px] text-ink-400">Ultimos 7 dias, hoy resaltado.</p>
                  <div className="mt-3 h-[200px]">
                    <ServicesTrendChart data={weeklyServiceTrend} />
                  </div>
                </GlassCard>

                <GlassCard className="flex flex-col">
                  <h2 className="text-[15px] font-semibold text-ink-50">Servicios hoy</h2>
                  <span className="mt-2 block text-[32px] font-semibold text-ink-50">
                    {servicePeriodStats.total}
                  </span>
                  <div className="mt-3 h-[120px] flex-1">
                    <ServicesWeekBarChart data={weeklyServiceTrend} />
                  </div>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ProgressRing
                  label="Servicios completados"
                  value={`${servicePeriodStats.total > 0 ? Math.round((servicePeriodStats.completados / servicePeriodStats.total) * 100) : 0}%`}
                  percent={servicePeriodStats.total > 0 ? (servicePeriodStats.completados / servicePeriodStats.total) * 100 : 0}
                  color="#16a34a"
                  size={128}
                  legend={[
                    { label: "Completados", value: servicePeriodStats.completados, color: "#16a34a" },
                    { label: "Resto", value: servicePeriodStats.total - servicePeriodStats.completados, color: "#9ca3af" },
                  ]}
                />
                <Link to="/choferes" className="block">
                  <ProgressRing
                    label="Choferes activos"
                    value={`${driverStats.total > 0 ? Math.round((driverStats.activos / driverStats.total) * 100) : 0}%`}
                    percent={driverStats.total > 0 ? (driverStats.activos / driverStats.total) * 100 : 0}
                    color="#2563eb"
                    size={128}
                    legend={[
                      { label: "Activos", value: driverStats.activos, color: "#2563eb" },
                      { label: "Inactivos", value: driverStats.total - driverStats.activos, color: "#9ca3af" },
                    ]}
                  />
                </Link>
                <Link to="/vehiculos" className="block">
                  <ProgressRing
                    label="Vehiculos disponibles"
                    value={`${vehicleStats.total > 0 ? Math.round((vehicleStats.disponibles / vehicleStats.total) * 100) : 0}%`}
                    percent={vehicleStats.total > 0 ? (vehicleStats.disponibles / vehicleStats.total) * 100 : 0}
                    color="#f59e0b"
                    size={128}
                    legend={[
                      { label: "Disponibles", value: vehicleStats.disponibles, color: "#f59e0b" },
                      { label: "No disponibles", value: vehicleStats.total - vehicleStats.disponibles, color: "#9ca3af" },
                    ]}
                  />
                </Link>
              </div>

              <GlassCard>
                <h2 className="text-[15px] font-semibold text-ink-50">Ultimos servicios</h2>
                <p className="mt-1 text-[12px] text-ink-400">
                  Los 6 mas recientes, de cualquier seccion y estado.
                </p>

                {recentRecords.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ink-300">Todavia no hay servicios cargados.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {recentRecords.map((record) => (
                      <li key={record.id}>
                        <Link
                          to={`/records/${record.id}`}
                          className="flex items-center gap-3 rounded-xl glass-surface-sm px-3 py-2.5 text-[13px] transition-colors hover:bg-line/[0.08]"
                        >
                          <Avatar user={record.driver} className="h-8 w-8 shrink-0 text-[12px]" />
                          <span className="min-w-0 flex-1 truncate text-ink-50">
                            {record.codigo} <span className="text-ink-400">- {record.client?.nombre ?? "-"}</span>
                          </span>
                          <span className="hidden shrink-0 text-[12px] text-ink-400 sm:inline">
                            {formatDate(record.fechaServicio)}
                          </span>
                          <StatusBadge status={record.estado} className="shrink-0 px-2 py-0.5 text-[10px]" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </>
          )}
        </>
      )}

      {tab === "diario" && (
        <>
          {loading && (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6 border-line/20 border-t-line" />
            </div>
          )}

          {!loading && groups.length === 0 && (
            <GlassCard className="text-center text-[14px] text-ink-300">
              Sin alertas pendientes. Todo al dia.
            </GlassCard>
          )}

          {!loading &&
            groups.map((group) => (
              <GlassCard key={group.label}>
                <h2 className="text-[15px] font-semibold text-ink-50">
                  {group.label} <span className="text-ink-400">({group.items.length})</span>
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {group.items.map((alert) => {
                    const itemClassName = clsx(
                      "block rounded-xl border px-4 py-3 text-[13px]",
                      SEVERITY_ITEM_CLASSES[alert.severity] ?? SEVERITY_ITEM_CLASSES.warning
                    );
                    return (
                      <li key={alert.id} className="flex items-start gap-2.5">
                        <span
                          className={clsx(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            SEVERITY_DOT_CLASSES[alert.severity] ?? SEVERITY_DOT_CLASSES.warning
                          )}
                        />
                        {alert.link ? (
                          <Link to={alert.link} className={clsx(itemClassName, "flex-1 hover:brightness-110")}>
                            {alert.message}
                          </Link>
                        ) : (
                          <div className={clsx(itemClassName, "flex-1")}>{alert.message}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </GlassCard>
            ))}
        </>
      )}

      {tab === "semanal" && isPrivileged && (
        <>
          <Alert>{weeklyError}</Alert>

          {!weeklyLoaded && (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6 border-line/20 border-t-line" />
            </div>
          )}

          {weeklyLoaded && (
            <>
              <RankingCard
                title="Choferes esta semana"
                subtitle="KM recorridos (planificado o real), de mayor a menor."
                entries={driverRanking.slice(0, 8)}
                emptyLabel="Sin servicios esta semana todavia."
                inactiveLabel={`Sin actividad esta semana (${inactiveDriverNames.length})`}
                inactiveNames={inactiveDriverNames}
              />
              <RankingCard
                title="Vehiculos esta semana"
                subtitle="KM recorridos, de mayor a menor."
                entries={fleetRanking.slice(0, 8)}
                emptyLabel="Sin servicios esta semana todavia."
                inactiveLabel={`Sin uso esta semana (${inactiveVehicleNames.length})`}
                inactiveNames={inactiveVehicleNames}
              />
              <RankingCard
                title="Extras Piazza por zona"
                subtitle="Milano vs Roma, KM y servicios de la semana. La mayoria va a aparecer 'Sin zona' hasta que se cargue en Nuevo servicio."
                entries={zonaBreakdown}
                emptyLabel="Sin servicios de Extras Piazza esta semana todavia."
                inactiveLabel=""
                inactiveNames={[]}
              />
              <GlassCard>
                <h2 className="mb-3 text-[15px] font-semibold text-ink-50">
                  Servicios de la semana &middot; Extras Piazza + DHL/AB Service
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ProfitLossList title="Mas rentables" items={economicStats.masRentables} tone="green" />
                  <ProfitLossList title="Con perdidas" items={economicStats.conPerdidas} tone="red" />
                </div>
              </GlassCard>
            </>
          )}
        </>
      )}
    </div>
  );
};
