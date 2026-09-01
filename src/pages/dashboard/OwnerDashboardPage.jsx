import clsx from "clsx";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { ProgressRing } from "../../components/ui/ProgressRing";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { CHART_COLORS } from "../../lib/constants";
import {
  computeClientDistribution,
  computeEconomicStats,
  computeMonthlyKmTrend,
  computeMonthlyRevenueTrend,
  isDhlAbRecord,
  isDhlRomaRecord,
  isExtrasStefaniaRecord,
} from "../../lib/dashboardStats";
import { formatCurrency, formatCurrencyCompact } from "../../lib/format";
import { listRecordsRequest } from "../../lib/records.api";

// Lazy: los 4 graficos (y recharts, la libreria detras) se descargan y ejecutan en
// paralelo en vez de bloquear el primer pintado de la pagina (titulo + anillos de
// Control economico, arriba de todo esto en el JSX) - sin esto el navegador tenia que
// terminar de parsear recharts antes de mostrar cualquier cosa.
const ClientDistributionChart = lazy(() => import("../../components/charts/ClientDistributionChart"));
const EconomicsChart = lazy(() => import("../../components/charts/EconomicsChart"));
const KmTrendChart = lazy(() => import("../../components/charts/KmTrendChart"));
const RevenueTrendChart = lazy(() => import("../../components/charts/RevenueTrendChart"));

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
const monthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase();

// Este dashboard es unicamente "Piazza + DHL Roma" (Extras Piazza Milano + Extras
// Piazza Roma + DHL Roma) - pedido explicito: ya no se ofrece Extras Piazza/DHL -
// AB Service/Extras Stefania como secciones aparte, ni siquiera al ADMIN de area
// DHL (el selector de seccion que existia se saco entero, junto con
// scopedDashboardSections/ADMIN_AREA_DASHBOARD_SECTION en lib/permissions.js y
// lib/constants.js - ya no queda nada que scopear aca). Sin AB Service ni DHL
// Milano en la cuenta - ver isDhlRomaRecord en dashboardStats.js. "General" junta
// las 3; el resto aisla una sola.
const MIS_AREAS_VISTA_OPTIONS = [
  { value: "TODAS", label: "General" },
  { value: "PIAZZA_MILANO", label: "Piazza Milano" },
  { value: "PIAZZA_ROMA", label: "Piazza Roma" },
  { value: "DHL_ROMA", label: "DHL Roma" },
];
const MIS_AREAS_VISTA_LABELS = {
  TODAS: "Vista general",
  PIAZZA_MILANO: "Piazza Milano",
  PIAZZA_ROMA: "Piazza Roma",
  DHL_ROMA: "DHL Roma",
};

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

  // Todo el bloque de Control economico mira Piazza + DHL Roma (ver comentario de
  // MIS_AREAS_VISTA_OPTIONS mas arriba) - sin zona cargada en Extras Piazza cuenta
  // como Milano (mismo criterio que ya se usaba con spedizzione null = Extras Piazza).
  const scopedRecords = useMemo(() => {
    if (!loaded) return null;
    const piazza = records.filter((r) => !isDhlAbRecord(r) && !isExtrasStefaniaRecord(r));
    const dhlRoma = records.filter((r) => isDhlRomaRecord(r));
    if (misAreasVista === "PIAZZA_MILANO") return piazza.filter((r) => r.extrasPiazzaZona !== "ROMA");
    if (misAreasVista === "PIAZZA_ROMA") return piazza.filter((r) => r.extrasPiazzaZona === "ROMA");
    if (misAreasVista === "DHL_ROMA") return dhlRoma;
    return [...piazza, ...dhlRoma];
  }, [loaded, records, misAreasVista]);

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

  const sectionHeading = `Piazza + DHL Roma - ${MIS_AREAS_VISTA_LABELS[misAreasVista]}`;
  // Para el sublabel de los modales de desglose (Facturacion/Costos/Ganancia): con
  // "Mes" se ve el mes puntual elegido (ej. "MARZO 2026"), no la palabra generica "Mes".
  const periodLabel =
    period === "mes" ? monthLabel(selectedMonth.year, selectedMonth.month) : PERIOD_OPTIONS.find((o) => o.value === period)?.label;

  if (error) return <Alert>{error}</Alert>;

  if (!loaded) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Hola, {user?.nombre}</h1>
          <p className="mt-1 text-[14px] text-ink-300">Vision general del negocio.</p>
        </div>
      </div>

      {/* Control economico: bloques de alto natural, en orden de prioridad (resumen ->
          tendencia -> comparativas -> detalle) - se ve todo desplegado en la pagina,
          sin pelear con una caja chica. */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold text-ink-50">
            Control economico <span className="text-ink-400">- {sectionHeading}</span>
          </h2>
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </div>

        {/* Solo con "Mes": elegir un mes puntual en vez de siempre el actual (mismo
            patron que el acordeon de Registros - shiftMonth/monthLabel arriba). */}
        {period === "mes" && (
          <div className="flex items-center justify-between gap-2 rounded-xl glass-surface-sm px-4 py-2.5">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
            >
              &larr; Mes anterior
            </button>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-100">
              {monthLabel(selectedMonth.year, selectedMonth.month)}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
            >
              Mes siguiente &rarr;
            </button>
          </div>
        )}

        {/* General/Piazza Milano/Piazza Roma/DHL Roma - ver MIS_AREAS_VISTA_OPTIONS
            mas arriba. */}
        <SegmentedControl options={MIS_AREAS_VISTA_OPTIONS} value={misAreasVista} onChange={setMisAreasVista} />

        {/* Anillos de progreso: cada uno cuenta algo distinto (no son 3 veces la
            misma metrica) - facturacion vs el periodo anterior, costos como % de lo
            facturado, y margen de ganancia sobre lo facturado. */}
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

        {/* Tendencia mes a mes del anio en curso (facturacion + ganancia). Siempre
            anual, no depende del selector Hoy/Semana/Mes de arriba. */}
        <GlassCard>
          <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">
            Tendencia {new Date().getFullYear()}
          </h3>
          <div className="mt-3 h-[240px]">
            <Suspense fallback={<ChartFallback />}>
              <RevenueTrendChart data={monthlyTrend} />
            </Suspense>
          </div>
        </GlassCard>

        {/* Mismo formato que el grafico de arriba, pero de km recorridos (no de
            dinero) - color propio (CHART_COLORS.km) para diferenciarlo de un
            vistazo. */}
        <GlassCard>
          <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">
            Kilometros {new Date().getFullYear()}
          </h3>
          <div className="mt-3 h-[240px]">
            <Suspense fallback={<ChartFallback />}>
              <KmTrendChart data={monthlyKmTrend} />
            </Suspense>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
                Facturacion vs costos
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
                Distribucion por cliente
              </h3>
              <div className="h-[220px]">
                <Suspense fallback={<ChartFallback />}>
                  <ClientDistributionChart data={clientDistribution} />
                </Suspense>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RankedList
              title="Servicios mas rentables"
              items={economicStats.masRentables}
              tone="green"
            />
            <RankedList title="Servicios con perdidas" items={economicStats.conPerdidas} tone="red" />
          </div>
        </GlassCard>
      </div>
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
