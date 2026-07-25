import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ClientDistributionChart } from "../../components/charts/ClientDistributionChart";
import { EconomicsChart } from "../../components/charts/EconomicsChart";
import { KmTrendChart } from "../../components/charts/KmTrendChart";
import { RevenueTrendChart } from "../../components/charts/RevenueTrendChart";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { ProgressRing } from "../../components/ui/ProgressRing";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { CHART_COLORS } from "../../lib/constants";
import {
  computeClientDistribution,
  computeEconomicStats,
  computeMonthlyKmTrend,
  computeMonthlyRevenueTrend,
  isDhlAbRecord,
} from "../../lib/dashboardStats";
import { formatCurrency, formatCurrencyCompact } from "../../lib/format";
import { scopedDashboardSection } from "../../lib/permissions";
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

// Sub-division de Extras Piazza (Record.extrasPiazzaZona). Hoy toda la operacion de
// Extras Piazza es Milano (Roma todavia no arranco) y casi ningun registro tiene la
// zona cargada, asi que un registro sin zona cuenta como Milano (mismo criterio que
// ya se usa con spedizzione null = Extras Piazza) en vez de un balde "sin zona"
// aparte. "General" no filtra nada, para ver ambas zonas juntas. DHL/AB Service no
// tiene este concepto, este selector solo aparece dentro de Extras Piazza.
const ZONA_OPTIONS = [
  { value: "TODAS", label: "General" },
  { value: "MILANO", label: "Milano" },
  { value: "ROMA", label: "Roma" },
];
const ZONA_LABELS = { TODAS: "Vista general", MILANO: "Piazza Milano", ROMA: "Piazza Roma" };

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
  // ADMIN "de area" (ver lib/permissions.js): arranca ya en su unica seccion, el
  // backend tampoco le manda registros de la otra.
  const scopedSection = scopedDashboardSection(user);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("mes");
  const [section, setSection] = useState(scopedSection ?? "extras_piazza");
  const [zona, setZona] = useState("TODAS");
  const [openBreakdown, setOpenBreakdown] = useState(null);

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
  // mezclarlos en el mismo numero. Dentro de Extras Piazza, ademas se acota por
  // zona (Milano/Roma/Sin zona) - DHL/AB Service no tiene este concepto.
  const scopedRecords = useMemo(() => {
    if (!loaded) return null;
    const bySection = records.filter((r) => (section === "dhl_ab" ? isDhlAbRecord(r) : !isDhlAbRecord(r)));
    if (section !== "extras_piazza" || zona === "TODAS") return bySection;
    // Sin zona cargada cuenta como Milano (ver comentario de ZONA_OPTIONS).
    return bySection.filter((r) =>
      zona === "MILANO" ? r.extrasPiazzaZona !== "ROMA" : r.extrasPiazzaZona === "ROMA"
    );
  }, [loaded, records, section, zona]);

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
  const monthlyKmTrend = useMemo(
    () => (loaded ? computeMonthlyKmTrend(scopedRecords) : null),
    [loaded, scopedRecords]
  );

  const sectionHeading =
    section === "extras_piazza" ? `${SECTION_LABEL[section]} - ${ZONA_LABELS[zona]}` : SECTION_LABEL[section];

  if (error) return <Alert>{error}</Alert>;

  if (!loaded) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Hola, {user?.nombre}</h1>
          <p className="mt-1 text-[14px] text-ink-300">Vision general del negocio.</p>
        </div>
        {/* Extras Piazza y DHL/AB Service tienen estructuras de costos distintas (ver
            recordCost en dashboardStats.js), asi que todo Control economico de abajo
            mira solo la seccion elegida aca. Un ADMIN de area no tiene otra seccion
            a la que cambiar (el backend tampoco le manda esos registros). */}
        {!scopedSection && (
          <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={setSection} />
        )}
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

        {/* Solo dentro de Extras Piazza: Milano/Roma/Sin zona (ver extrasPiazzaZona
            en el schema). DHL/AB Service no se subdivide asi. */}
        {section === "extras_piazza" && (
          <SegmentedControl options={ZONA_OPTIONS} value={zona} onChange={setZona} />
        )}

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
            sublabel={`${sectionHeading} - ${PERIOD_OPTIONS.find((o) => o.value === period)?.label}`}
            rows={economicStats.facturacionBreakdown}
            total={economicStats.facturacion}
            onClose={() => setOpenBreakdown(null)}
          />
        )}
        {openBreakdown === "costos" && (
          <EconomicBreakdownModal
            title="Costos operativos"
            sublabel={`${sectionHeading} - ${PERIOD_OPTIONS.find((o) => o.value === period)?.label}`}
            rows={economicStats.costosBreakdown}
            total={economicStats.costos}
            onClose={() => setOpenBreakdown(null)}
          />
        )}
        {openBreakdown === "ganancia" && (
          <EconomicBreakdownModal
            title="Ganancia estimada"
            sublabel={`${sectionHeading} - ${PERIOD_OPTIONS.find((o) => o.value === period)?.label}`}
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
            <RevenueTrendChart data={monthlyTrend} />
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
            <KmTrendChart data={monthlyKmTrend} />
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
