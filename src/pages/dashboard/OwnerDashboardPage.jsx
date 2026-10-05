import clsx from "clsx";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { AreaBadge } from "../../components/records/AreaBadge";
import { KpiCard } from "../../components/ui/KpiCard";
import {
  BarsIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  RouteIcon,
  TrendIcon,
  TruckIcon,
  UsersIcon,
  ArrowDownIcon,
  ArrowUpIcon,
} from "../../components/ui/icons";
import { PageLoader } from "../../components/ui/PageLoader";
import { ProgressRing } from "../../components/ui/ProgressRing";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { CHART_COLORS } from "../../lib/constants";
import {
  computeAreaBreakdown,
  computeClientDistribution,
  computeEconomicStats,
  computeFleetKmTable,
  computeMonthlyKmTrend,
  computeMonthlyRevenueTrend,
  computeMonthlyServicesTrend,
  computePeriodKpis,
  filterToMainAreas,
} from "../../lib/dashboardStats";
import { AREAS_BY_KEY, RECORD_AREAS, classifyRecord } from "../../lib/recordAreas";
import { formatCurrency, formatCurrencyCompact } from "../../lib/format";
import { listRecordsRequest } from "../../lib/records.api";

// Lazy: los 4 graficos (y recharts, la libreria detras) se descargan y ejecutan en
// paralelo en vez de bloquear el primer pintado de la pagina (titulo + anillos de
// Control economico, arriba de todo esto en el JSX) - sin esto el navegador tenia que
// terminar de parsear recharts antes de mostrar cualquier cosa.
const ClientDistributionChart = lazy(() => import("../../components/charts/ClientDistributionChart"));
const EconomicsChart = lazy(() => import("../../components/charts/EconomicsChart"));
const PerformanceTrendChart = lazy(() => import("../../components/charts/PerformanceTrendChart"));
const ServicesMonthBarChart = lazy(() => import("../../components/charts/ServicesMonthBarChart"));

const ChartFallback = () => (
  <div className="flex h-full items-center justify-center">
    <Spinner className="h-5 w-5 border-line/20 border-t-line" />
  </div>
);

const PERIOD_OPTIONS = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

const PERIOD_DELTA_LABEL = {
  hoy: "vs ayer",
  semana: "vs semana pasada",
  mes: "vs mes pasado",
};

// Navegador de mes puntual para el periodo "Mes" del Control economico (antes
// siempre mostraba el mes en curso, sin forma de mirar uno pasado) - mismo patron
// que el acordeon de Registros (shiftMonth/monthLabel en RecordsListPage.jsx).
const shiftMonth = ({ year, month }, delta) => {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Selector de mes del encabezado (reemplaza la barra "Mes anterior / Mes siguiente").
const MonthPicker = ({ value, onChange }) => (
  <div className="glass-surface-sm flex items-center gap-1 rounded-xl px-1.5 py-1">
    <button
      type="button"
      aria-label="Mes anterior"
      onClick={() => onChange(shiftMonth(value, -1))}
      className="rounded-lg p-1.5 text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
    >
      <ChevronLeftIcon className="h-4 w-4" />
    </button>
    <span className="flex min-w-[9.5rem] items-center justify-center gap-2 px-1 text-[14px] font-medium text-ink-50">
      <CalendarIcon className="h-4 w-4 text-ink-300" />
      {MONTH_NAMES[value.month - 1]} {value.year}
    </span>
    <button
      type="button"
      aria-label="Mes siguiente"
      onClick={() => onChange(shiftMonth(value, 1))}
      className="rounded-lg p-1.5 text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
    >
      <ChevronRightIcon className="h-4 w-4" />
    </button>
  </div>
);

// Tarjeta de seccion del dashboard: encabezado con icono + titulo + subtitulo.
const Panel = ({ icon: Icon, title, subtitle, aside, children, className, tint = "#2f8dff" }) => (
  <section className={clsx("glass-surface rounded-2xl p-5 sm:p-6", className)}>
    {(title || aside) && (
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ color: tint, backgroundColor: `${tint}26`, boxShadow: `inset 0 0 0 1px ${tint}40` }}
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div>
            <h3 className="text-[16px] font-semibold text-ink-50">{title}</h3>
            {subtitle && <p className="text-[13px] text-ink-400">{subtitle}</p>}
          </div>
        </div>
        {aside}
      </header>
    )}
    {children}
  </section>
);

const Delta = ({ pct }) =>
  pct == null ? (
    <span className="text-ink-400">—</span>
  ) : (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 font-semibold",
        pct >= 0 ? "text-success-500" : "text-danger-500"
      )}
    >
      {pct >= 0 ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(0)}%
    </span>
  );

const monthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase();

// Vistas del dashboard: "General" junta las 5 areas (DHL Milano, DHL Roma, Extras Piazza
// Milano, Extras Piazza Roma y AB Service) y las demas aislan una sola - mismas areas que
// Registros (ver lib/recordAreas.js). "Otros" (Extras Stefania) no entra, como antes.
const MAIN_AREAS = RECORD_AREAS.filter((a) => a.key !== "otros");
const MIS_AREAS_VISTA_OPTIONS = [
  { value: "TODAS", label: "General" },
  ...MAIN_AREAS.map((a) => ({ value: a.key, label: a.shortLabel ?? a.label })),
];
const vistaLabel = (value) => (value === "TODAS" ? "Vista general" : (AREAS_BY_KEY[value]?.label ?? value));

// Detalle de que compone un anillo de Control economico (facturacion/costos/
// ganancia), agrupado por categoria - ver facturacionBreakdown/costosBreakdown
// en computeEconomicStats. Reutilizado para los 3 anillos, cada uno pasa sus
// propias filas.
const EconomicBreakdownModal = ({ title, sublabel, rows, total, onClose }) => {
  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />
      <div className="glass-surface relative z-10 w-full max-w-sm rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-400">{sublabel}</p>

        <div className="mt-4 flex flex-col gap-2">
          {rows.map(({ label, monto, count }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 rounded-xl glass-surface-sm px-3 py-2 text-[13px]"
            >
              <span className="text-ink-50">
                {label}
                {count != null && <span className="text-ink-400"> ({count})</span>}
              </span>
              <span className="shrink-0 text-ink-300">{formatCurrency(monto)}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between rounded-xl bg-accent-500/10 px-3 py-2 text-[13px] font-medium">
            <span className="text-ink-50">Total</span>
            <span className="text-ink-50">{formatCurrency(total)}</span>
          </div>
        </div>

        <Button variant="ghost" className="mt-6" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>,
    document.body
  );
};

export const OwnerDashboardPage = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("mes");
  const [misAreasVista, setMisAreasVista] = useState("TODAS");
  const [openBreakdown, setOpenBreakdown] = useState(null);
  // Mes puntual del periodo "Mes" (ver monthLabel/shiftMonth mas arriba) - arranca en
  // el mes en curso, igual que antes de poder elegir otro.
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  useEffect(() => {
    let cancelled = false;

    listRecordsRequest()
      .then((recordsData) => {
        if (cancelled) return;
        setRecords(recordsData);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = Boolean(records);

  // Registros de las 5 areas principales (sin "Otros"); sin zona cargada, Extras Piazza y DHL
  // cuentan como Milano (ver classifyRecord).
  const mainRecords = useMemo(() => (loaded ? filterToMainAreas(records) : null), [loaded, records]);

  // Lo que ve el dashboard segun la vista elegida: todas las areas o una sola.
  const scopedRecords = useMemo(() => {
    if (!mainRecords) return null;
    if (misAreasVista === "TODAS") return mainRecords;
    return mainRecords.filter((r) => classifyRecord(r) === misAreasVista);
  }, [mainRecords, misAreasVista]);

  const economicStats = useMemo(
    () => (loaded ? computeEconomicStats(scopedRecords, period, new Date(), selectedMonth) : null),
    [loaded, scopedRecords, period, selectedMonth]
  );
  const clientDistribution = useMemo(
    () => (loaded ? computeClientDistribution(scopedRecords, period, new Date(), selectedMonth) : null),
    [loaded, scopedRecords, period, selectedMonth]
  );
  const monthlyTrend = useMemo(
    () => (loaded ? computeMonthlyRevenueTrend(scopedRecords) : null),
    [loaded, scopedRecords]
  );
  const monthlyKmTrend = useMemo(
    () => (loaded ? computeMonthlyKmTrend(scopedRecords) : null),
    [loaded, scopedRecords]
  );

  const kpis = useMemo(
    () => (loaded ? computePeriodKpis(scopedRecords, period, new Date(), selectedMonth) : null),
    [loaded, scopedRecords, period, selectedMonth]
  );
  const fleetKmTable = useMemo(
    () => (loaded ? computeFleetKmTable(scopedRecords, period, new Date(), selectedMonth) : null),
    [loaded, scopedRecords, period, selectedMonth]
  );
  const servicesTrend = useMemo(
    () => (loaded ? computeMonthlyServicesTrend(scopedRecords) : null),
    [loaded, scopedRecords]
  );
  const performanceData = useMemo(
    () =>
      monthlyKmTrend && monthlyTrend
        ? monthlyKmTrend.map((m, i) => ({ month: m.month, km: m.km, facturacion: monthlyTrend[i].facturacion }))
        : null,
    [monthlyKmTrend, monthlyTrend]
  );

  const areaBreakdown = useMemo(
    () => (loaded ? computeAreaBreakdown(mainRecords, period, new Date(), selectedMonth) : null),
    [loaded, mainRecords, period, selectedMonth]
  );

  const sectionHeading = vistaLabel(misAreasVista);
  // Para el sublabel de los modales de desglose (Facturacion/Costos/Ganancia): con
  // "Mes" se ve el mes puntual elegido (ej. "MARZO 2026"), no la palabra generica "Mes".
  const periodLabel =
    period === "mes" ? monthLabel(selectedMonth.year, selectedMonth.month) : PERIOD_OPTIONS.find((o) => o.value === period)?.label;

  if (error) return <Alert>{error}</Alert>;

  if (!loaded) return <PageLoader />;

  const year = new Date().getFullYear();
  const deltaLabel = PERIOD_DELTA_LABEL[period];
  const totalServiciosAnio = servicesTrend.reduce((sum, m) => sum + m.servicios, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado: saludo a la izquierda, mes + periodo a la derecha. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Hola, {user?.nombre}</h1>
          <p className="mt-1 text-[14px] text-ink-300">Aquí tienes un resumen del rendimiento de tu negocio.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {period === "mes" && <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />}
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* General o una sola area - ver MIS_AREAS_VISTA_OPTIONS. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-medium text-ink-400">Vista</span>
        <SegmentedControl options={MIS_AREAS_VISTA_OPTIONS} value={misAreasVista} onChange={setMisAreasVista} />
      </div>

      {/* Indicadores del periodo, con variacion contra el periodo anterior. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          icon={ClipboardListIcon}
          label="Servicios"
          color="#2f8dff"
          value={kpis.servicios.value.toLocaleString("es-AR")}
          deltaPct={kpis.servicios.deltaPct}
          deltaLabel={deltaLabel}
          series={kpis.servicios.series}
        />
        <KpiCard
          icon={RouteIcon}
          label="Kilómetros"
          color="#22d3ee"
          value={`${Math.round(kpis.km.value).toLocaleString("es-AR")} km`}
          deltaPct={kpis.km.deltaPct}
          deltaLabel={deltaLabel}
          series={kpis.km.series}
        />
        <KpiCard
          icon={UsersIcon}
          label="Clientes atendidos"
          color="#a78bfa"
          value={kpis.clientes.value.toLocaleString("es-AR")}
          deltaPct={kpis.clientes.deltaPct}
          deltaLabel={deltaLabel}
          series={kpis.clientes.series}
        />
        <KpiCard
          icon={TruckIcon}
          label="Vehículos en uso"
          color="#ffa826"
          value={kpis.vehiculos.value.toLocaleString("es-AR")}
          deltaPct={kpis.vehiculos.deltaPct}
          deltaLabel={deltaLabel}
          series={kpis.vehiculos.series}
        />
      </div>

      {/* Servicios por area del periodo: DHL Milano, DHL Roma, Extras Piazza Milano/Roma y
          AB Service contados juntos; tocar una area filtra todo el dashboard a esa area. */}
      <Panel
        icon={ClipboardListIcon}
        tint="#facc15"
        title="Servicios por área"
        subtitle={`${period === "mes" ? `${MONTH_NAMES[selectedMonth.month - 1]} ${selectedMonth.year}` : periodLabel} · toca un área para filtrar el dashboard`}
        aside={
          <span className="text-[12px] text-ink-300">
            Total:{" "}
            <span className="font-semibold text-ink-50">
              {MAIN_AREAS.reduce((n, a) => n + areaBreakdown[a.key].count, 0).toLocaleString("es-AR")}
            </span>
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {MAIN_AREAS.map((a) => {
            const stat = areaBreakdown[a.key];
            const total = MAIN_AREAS.reduce((n, x) => n + areaBreakdown[x.key].count, 0);
            const share = total > 0 ? Math.round((stat.count / total) * 100) : 0;
            const active = misAreasVista === a.key;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => setMisAreasVista(active ? "TODAS" : a.key)}
                aria-pressed={active}
                className={clsx(
                  "rounded-xl border p-3.5 text-left transition-colors hover:bg-line/[0.05]",
                  active ? "border-accent-500/60 bg-accent-500/10" : "border-line/10"
                )}
              >
                <span className="flex items-center gap-2">
                  <AreaBadge areaKey={a.key} size={26} />
                  <span className="truncate text-[12px] font-medium text-ink-200">{a.label}</span>
                </span>
                <span className="mt-2.5 block text-[26px] font-semibold leading-none tracking-tight text-ink-50">
                  {stat.count.toLocaleString("es-AR")}
                </span>
                <span className="mt-1 block text-[11px] text-ink-400">
                  {share}% · {Math.round(stat.km).toLocaleString("es-AR")} km
                </span>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line/10">
                  <span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: a.chartColor }} />
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Control economico: se mantiene tal cual - anillos de progreso con su
          desglose al tocar cada uno. Cada anillo cuenta algo distinto (no son 3 veces
          la misma metrica): facturacion vs el periodo anterior, costos como % de lo
          facturado, y margen de ganancia sobre lo facturado. */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[18px] font-semibold text-ink-50">
          Control económico <span className="text-ink-400">- {sectionHeading}</span>
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ProgressRing
            label="Facturacion"
            value={formatCurrencyCompact(economicStats.facturacion)}
            percent={
              economicStats.facturacionDeltaPct != null
                ? Math.min(100, 100 + economicStats.facturacionDeltaPct)
                : economicStats.facturacion > 0
                  ? 100
                  : 0
            }
            sublabel={
              economicStats.facturacionDeltaPct != null
                ? `${economicStats.facturacionDeltaPct >= 0 ? "+" : ""}${economicStats.facturacionDeltaPct.toFixed(1)}% ${PERIOD_DELTA_LABEL[period]}`
                : PERIOD_DELTA_LABEL[period]
            }
            color={CHART_COLORS.facturacion}
            onClick={() => setOpenBreakdown("facturacion")}
          />
          <ProgressRing
            label="Costos operativos"
            value={formatCurrencyCompact(economicStats.costos)}
            percent={economicStats.facturacion > 0 ? (economicStats.costos / economicStats.facturacion) * 100 : 0}
            sublabel={
              economicStats.facturacion > 0
                ? `${Math.round((economicStats.costos / economicStats.facturacion) * 100)}% de la facturacion`
                : "Sin facturacion"
            }
            color={CHART_COLORS.costos}
            onClick={() => setOpenBreakdown("costos")}
          />
          <ProgressRing
            label="Ganancia estimada"
            value={formatCurrencyCompact(economicStats.ganancia)}
            percent={economicStats.facturacion > 0 ? (economicStats.ganancia / economicStats.facturacion) * 100 : 0}
            sublabel={
              economicStats.facturacion > 0
                ? `${Math.round((economicStats.ganancia / economicStats.facturacion) * 100)}% de margen`
                : "Sin facturacion"
            }
            onClick={() => setOpenBreakdown("ganancia")}
            color={economicStats.ganancia >= 0 ? CHART_COLORS.gananciaPositiva : CHART_COLORS.gananciaNegativa}
          />
        </div>
      </div>

      {openBreakdown === "facturacion" && (
        <EconomicBreakdownModal
          title="Facturacion"
          sublabel={`${sectionHeading} - ${periodLabel}`}
          rows={economicStats.facturacionBreakdown}
          total={economicStats.facturacion}
          onClose={() => setOpenBreakdown(null)}
        />
      )}
      {openBreakdown === "costos" && (
        <EconomicBreakdownModal
          title="Costos operativos"
          sublabel={`${sectionHeading} - ${periodLabel}`}
          rows={economicStats.costosBreakdown}
          total={economicStats.costos}
          onClose={() => setOpenBreakdown(null)}
        />
      )}
      {openBreakdown === "ganancia" && (
        <EconomicBreakdownModal
          title="Ganancia estimada"
          sublabel={`${sectionHeading} - ${periodLabel}`}
          rows={[
            { label: "Facturacion", monto: economicStats.facturacion },
            { label: "Costos operativos", monto: -economicStats.costos },
          ]}
          total={economicStats.ganancia}
          onClose={() => setOpenBreakdown(null)}
        />
      )}

      {/* Tendencia del anio en curso (siempre anual, no depende de Hoy/Semana/Mes):
          kilometros y facturacion mes a mes. */}
      <Panel
        icon={TrendIcon}
        tint="#2f8dff"
        title="Tendencia de rendimiento"
        subtitle={`Evolución de la operación mes a mes en ${year}`}
        aside={
          <div className="flex items-center gap-4 text-[12px] text-ink-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#22d3ee]" />
              Kilómetros
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#2f8dff]" />
              Facturación
            </span>
          </div>
        }
      >
        <div className="h-[300px]">
          <Suspense fallback={<ChartFallback />}>
            <PerformanceTrendChart data={performanceData} />
          </Suspense>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          icon={TruckIcon}
          tint="#22d3ee"
          title="Kilómetros por vehículo"
          subtitle={`Rendimiento individual de la flota - ${
            period === "mes" ? `${MONTH_NAMES[selectedMonth.month - 1]} ${selectedMonth.year}` : periodLabel
          }`}
        >
          {fleetKmTable.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-400">
              Sin servicios con vehículo en este periodo.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-left text-ink-400">
                  <th className="pb-2 font-medium">Vehículo</th>
                  <th className="pb-2 text-right font-medium">Kilómetros</th>
                  <th className="pb-2 text-right font-medium">Var. periodo</th>
                </tr>
              </thead>
              <tbody>
                {fleetKmTable.map((row) => (
                  <tr key={row.id} className="border-b border-line/10 last:border-0">
                    <td className="py-3">
                      <Link
                        to={`/vehiculos/${row.id}`}
                        className="flex items-center gap-2.5 text-ink-50 hover:text-accent-400"
                      >
                        <TruckIcon className="h-4 w-4 shrink-0 text-ink-400" />
                        <span className="font-medium">{row.targa}</span>
                        {row.modelo && <span className="hidden truncate text-ink-400 sm:inline">{row.modelo}</span>}
                      </Link>
                    </td>
                    <td className="py-3 text-right text-ink-100">
                      {Math.round(row.km).toLocaleString("es-AR")} km
                    </td>
                    <td className="py-3 text-right">
                      <Delta pct={row.deltaPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          icon={BarsIcon}
          tint="#a78bfa"
          title="Servicios por mes"
          subtitle={`Cantidad de servicios realizados en ${year}${misAreasVista === "TODAS" ? ", por área" : ""}`}
          aside={
            <div className="text-right">
              <div className="text-[20px] font-semibold leading-none text-ink-50">
                {totalServiciosAnio.toLocaleString("es-AR")}
              </div>
              <div className="mt-1 text-[12px] text-ink-400">en el año</div>
            </div>
          }
        >
          <div className="h-[240px]">
            <Suspense fallback={<ChartFallback />}>
              <ServicesMonthBarChart
                data={servicesTrend}
                areaKeys={misAreasVista === "TODAS" ? MAIN_AREAS.map((a) => a.key) : [misAreasVista]}
              />
            </Suspense>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
              Facturación vs costos
            </h3>
            <div className="h-[220px]">
              <Suspense fallback={<ChartFallback />}>
                <EconomicsChart
                  facturacion={economicStats.facturacion}
                  costos={economicStats.costos}
                  ganancia={economicStats.ganancia}
                />
              </Suspense>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
              Distribución por cliente
            </h3>
            <div className="h-[220px]">
              <Suspense fallback={<ChartFallback />}>
                <ClientDistributionChart data={clientDistribution} />
              </Suspense>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RankedList title="Servicios más rentables" items={economicStats.masRentables} tone="green" />
          <RankedList title="Servicios con pérdidas" items={economicStats.conPerdidas} tone="red" />
        </div>
      </Panel>
    </div>
  );
};

const RankedList = ({ title, items, tone }) => (
  <div>
    <h3 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-ink-400">{title}</h3>
    {items.length === 0 ? (
      <p className="text-[13px] text-ink-400">Sin datos en este periodo.</p>
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
