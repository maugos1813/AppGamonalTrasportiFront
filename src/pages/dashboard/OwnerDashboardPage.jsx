import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClientDistributionChart } from "../../components/charts/ClientDistributionChart";
import { EconomicsChart } from "../../components/charts/EconomicsChart";
import { RevenueTrendChart } from "../../components/charts/RevenueTrendChart";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { ProgressRing } from "../../components/ui/ProgressRing";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { CHART_COLORS } from "../../lib/constants";
import {
  computeClientDistribution,
  computeEconomicStats,
  computeMonthlyRevenueTrend,
  isDhlAbRecord,
} from "../../lib/dashboardStats";
import { formatCurrency, formatCurrencyCompact } from "../../lib/format";
import { listRecordsRequest } from "../../lib/records.api";

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

const SECTION_OPTIONS = [
  { value: "extras_piazza", label: "Extras Piazza" },
  { value: "dhl_ab", label: "DHL - AB Service" },
];

const SECTION_LABEL = {
  extras_piazza: "Extras Piazza",
  dhl_ab: "DHL - AB Service",
};

export const OwnerDashboardPage = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("mes");
  const [section, setSection] = useState("extras_piazza");

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

  // Todo el bloque de Control economico mira solo la seccion elegida (Extras
  // Piazza o DHL - AB Service): son negocios con estructuras de costos distintas
  // (ver isDhlAbRecord/recordCost en dashboardStats.js), asi que no tiene sentido
  // mezclarlos en el mismo numero.
  const scopedRecords = useMemo(
    () => (loaded ? records.filter((r) => (section === "dhl_ab" ? isDhlAbRecord(r) : !isDhlAbRecord(r))) : null),
    [loaded, records, section]
  );

  const economicStats = useMemo(
    () => (loaded ? computeEconomicStats(scopedRecords, period) : null),
    [loaded, scopedRecords, period]
  );
  const clientDistribution = useMemo(
    () => (loaded ? computeClientDistribution(scopedRecords, period) : null),
    [loaded, scopedRecords, period]
  );
  const monthlyTrend = useMemo(
    () => (loaded ? computeMonthlyRevenueTrend(scopedRecords) : null),
    [loaded, scopedRecords]
  );

  if (error) return <Alert>{error}</Alert>;

  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 border-line/20 border-t-line" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Hola, {user?.nombre}</h1>
          <p className="mt-1 text-[14px] text-ink-300">Vision general del negocio.</p>
        </div>
        {/* Extras Piazza y DHL/AB Service tienen estructuras de costos distintas (ver
            recordCost en dashboardStats.js), asi que todo Control economico de abajo
            mira solo la seccion elegida aca. */}
        <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={setSection} />
      </div>

      {/* Control economico: bloques de alto natural, en orden de prioridad (resumen ->
          tendencia -> comparativas -> detalle) - se ve todo desplegado en la pagina,
          sin pelear con una caja chica. */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold text-ink-50">
            Control economico <span className="text-ink-400">- {SECTION_LABEL[section]}</span>
          </h2>
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </div>

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
            color={economicStats.ganancia >= 0 ? CHART_COLORS.gananciaPositiva : CHART_COLORS.gananciaNegativa}
          />
        </div>

        {/* Tendencia mes a mes del anio en curso (facturacion + ganancia). Siempre
            anual, no depende del selector Hoy/Semana/Mes de arriba. */}
        <GlassCard>
          <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">
            Tendencia {new Date().getFullYear()}
          </h3>
          <div className="mt-3 h-[240px]">
            <RevenueTrendChart data={monthlyTrend} />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
                Facturacion vs costos
              </h3>
              <div className="h-[220px]">
                <EconomicsChart
                  facturacion={economicStats.facturacion}
                  costos={economicStats.costos}
                  ganancia={economicStats.ganancia}
                />
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
                Distribucion por cliente
              </h3>
              <div className="h-[220px]">
                <ClientDistributionChart data={clientDistribution} />
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
