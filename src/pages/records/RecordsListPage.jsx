import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { APLICATIVO_LABELS, EN_PROCESO_STATUSES, TERMINADOS_STATUSES } from "../../lib/constants";
import { formatDate, formatTimeRemaining } from "../../lib/format";
import {
  listRecordsByDayRequest,
  listRecordsRequest,
  listRecordsSummaryByMonthRequest,
} from "../../lib/records.api";

const TAB_OPTIONS = [
  { value: "en_proceso", label: "En proceso" },
  { value: "terminados", label: "Terminados" },
];

const TAB_STATUSES = {
  en_proceso: EN_PROCESO_STATUSES,
  terminados: TERMINADOS_STATUSES,
};

// "Extras Piazza" es lo unico que existia hasta ahora: los registros viejos no
// tienen spedizzione cargada, asi que se tratan como Extras Piazza por defecto.
// "DHL - AB Service" agrupa ambos spedizzione; el alta desde esta seccion crea
// siempre servicios DHL (AB_SERVICE por ahora solo llega via sincronizacion externa).
const SECTIONS = {
  "extras-piazza": {
    label: "Extras Piazza",
    matchesSpedizzione: (s) => s === "EXTRA_PIAZZA" || s == null,
    allowCreate: true,
    newPath: "/records/extras-piazza/new",
  },
  "dhl-ab-service": {
    label: "DHL - AB Service",
    matchesSpedizzione: (s) => s === "DHL" || s === "AB_SERVICE",
    allowCreate: true,
    newPath: "/records/dhl-ab-service/new",
  },
};
const SECTION_OPTIONS = Object.entries(SECTIONS).map(([value, s]) => ({ value, label: s.label }));

// El backend arma los rangos /:year/:month/:day en UTC (buildDateRange). El resumen
// del mes se agrupa client-side, asi que tiene que usar el mismo criterio de "dia"
// (UTC), o el conteo del resumen y lo que trae el fetch puntual de un dia no van a
// coincidir para usuarios en husos horarios distintos a UTC.
const dayKey = (value) => {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const monthLabel = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
const dayLabel = (value) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });

const driverName = (record) =>
  record.driver ? `${record.driver.nombre} ${record.driver.apellido}` : "Sin chofer asignado";

// Agrupa el resumen (liviano, solo id/fechaServicio/estado) de un mes por dia de
// SERVICIO (no de creacion: un import historico masivo puede crearse todo el mismo
// dia pero corresponder a fechas de servicio bien distintas). Mas reciente primero.
const groupSummaryByDay = (list) => {
  const days = new Map();
  for (const item of list) {
    const dKey = dayKey(item.fechaServicio);
    if (!days.has(dKey)) days.set(dKey, { key: dKey, date: item.fechaServicio, count: 0 });
    days.get(dKey).count += 1;
  }
  return Array.from(days.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
};

const shiftMonth = ({ year, month }, delta) => {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
};

// Igual al SegmentedControl visualmente, pero enrutado (NavLink) en vez de
// controlado por estado, para que la seccion quede reflejada en la URL.
const SectionTabs = () => (
  <div className="inline-flex items-center gap-1 rounded-full glass-surface-sm p-1">
    {SECTION_OPTIONS.map((opt) => (
      <NavLink
        key={opt.value}
        to={`/records/${opt.value}`}
        className={({ isActive }) =>
          `rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
            isActive ? "bg-line/15 text-ink-50" : "text-ink-300 hover:text-ink-50"
          }`
        }
      >
        {opt.label}
      </NavLink>
    ))}
  </div>
);

const ChevronIcon = ({ open }) => (
  <svg
    className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DisclosureHeader = ({ open, onClick, children, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-2 text-left ${className ?? ""}`}
  >
    {children}
    <ChevronIcon open={open} />
  </button>
);

const RecordCard = ({ record }) => (
  <Link to={`/records/${record.id}`}>
    <GlassCard className="transition-colors hover:bg-line/[0.08]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-medium text-ink-400">{record.codigo}</span>
          <h2 className="mt-0.5 text-[17px] font-medium text-ink-50">{record.destinazione}</h2>
        </div>
        <StatusBadge status={record.estado} />
      </div>

      <p className="mt-2 line-clamp-2 text-[14px] text-ink-300">{record.descripcion}</p>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-400">
        <span>Servicio: {formatDate(record.fechaServicio)}</span>
        <span>ETA: {formatDate(record.eta)}</span>
        <span>
          Vehiculo: {record.vehicle?.targa} - {record.vehicle?.modelo}
        </span>
        <span>Cliente: {record.client?.nombre}</span>
      </div>
    </GlassCard>
  </Link>
);

const ROW_COLUMN_CLASSES = {
  chofer: "w-32 shrink-0 truncate",
  vehiculo: "w-28 shrink-0 truncate",
  estado: "w-24 shrink-0",
  eta: "w-56 shrink-0 truncate",
  km: "w-16 shrink-0 text-right",
  destino: "min-w-0 flex-1 truncate",
  aplicativo: "w-24 shrink-0 truncate text-right",
};

const CompactRowHeader = () => (
  <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
    <span className={ROW_COLUMN_CLASSES.chofer}>Chofer</span>
    <span className={ROW_COLUMN_CLASSES.vehiculo}>Vehiculo</span>
    <span className={ROW_COLUMN_CLASSES.estado}>Estado</span>
    <span className={ROW_COLUMN_CLASSES.eta}>ETA / restante</span>
    <span className={ROW_COLUMN_CLASSES.km}>KM</span>
    <span className={ROW_COLUMN_CLASSES.destino}>Destino</span>
    <span className={ROW_COLUMN_CLASSES.aplicativo}>Aplicativo</span>
  </div>
);

// Fila compacta (50px) para escanear muchos servicios de un mismo dia de un vistazo.
const RecordRow = ({ record }) => (
  <Link
    to={`/records/${record.id}`}
    className="flex h-[50px] items-center gap-3 rounded-xl px-4 text-[12px] text-ink-200 transition-colors hover:bg-line/[0.08]"
  >
    <span className={ROW_COLUMN_CLASSES.chofer} title={driverName(record)}>
      {driverName(record)}
    </span>
    <span className={ROW_COLUMN_CLASSES.vehiculo} title={record.vehicle?.targa}>
      {record.vehicle?.targa ?? "-"}
    </span>
    <span className={ROW_COLUMN_CLASSES.estado}>
      <StatusBadge status={record.estado} className="px-2 py-0.5 text-[11px]" />
    </span>
    <span
      className={ROW_COLUMN_CLASSES.eta}
      title={`${formatDate(record.eta)} - ${formatTimeRemaining(record.eta)}`}
    >
      {formatTimeRemaining(record.eta)}
    </span>
    <span className={ROW_COLUMN_CLASSES.km}>{record.kilometros ?? "-"}</span>
    <span className={ROW_COLUMN_CLASSES.destino} title={record.destinazione}>
      {record.destinazione}
    </span>
    <span className={ROW_COLUMN_CLASSES.aplicativo}>
      {APLICATIVO_LABELS[record.aplicativo] ?? "-"}
    </span>
  </Link>
);

const now = new Date();
const CURRENT_VIEW_DATE = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };

export const RecordsListPage = ({ section }) => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const sectionConfig = SECTIONS[section];
  const [error, setError] = useState("");
  const [tab, setTab] = useState("en_proceso");

  // --- Vista OWNER/ADMIN: navega mes a mes, trae solo un resumen liviano del mes
  // y recien pide los registros completos del dia cuando se despliega ese dia. ---
  const [viewDate, setViewDate] = useState(CURRENT_VIEW_DATE);
  const [summary, setSummary] = useState(null);
  const [openDays, setOpenDays] = useState(() => new Set());
  const [dayRecords, setDayRecords] = useState(() => new Map());
  const [loadingDays, setLoadingDays] = useState(() => new Set());
  const [dayErrors, setDayErrors] = useState(() => new Map());

  // --- Vista CHOFER: lista plana simple, trae todo de una (siempre es poco, son
  // solo sus propios servicios). ---
  const [records, setRecords] = useState(null);

  // Fuerza un re-render cada minuto para que "tiempo restante antes de vencer" no quede desactualizado.
  const [, setTick] = useState(0);
  useEffect(() => {
    const intervalId = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isPrivileged) return;
    let cancelled = false;

    listRecordsRequest()
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged]);

  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;
    setSummary(null);

    listRecordsSummaryByMonthRequest(viewDate.year, viewDate.month)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, viewDate.year, viewDate.month]);

  const fetchDay = (day) => {
    setLoadingDays((prev) => new Set(prev).add(day.key));
    const d = new Date(day.date);
    listRecordsByDayRequest(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      .then((data) => {
        setDayRecords((prev) => new Map(prev).set(day.key, data));
      })
      .catch((err) => {
        setDayErrors((prev) => new Map(prev).set(day.key, parseApiError(err).message));
      })
      .finally(() => {
        setLoadingDays((prev) => {
          const next = new Set(prev);
          next.delete(day.key);
          return next;
        });
      });
  };

  const toggleDay = (day) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day.key)) next.delete(day.key);
      else next.add(day.key);
      return next;
    });
    if (!dayRecords.has(day.key) && !loadingDays.has(day.key)) fetchDay(day);
  };

  const visibleRecords = records?.filter(
    (r) => TAB_STATUSES[tab].includes(r.estado) && sectionConfig.matchesSpedizzione(r.spedizzione)
  );
  const summaryDays = summary
    ? groupSummaryByDay(
        summary.filter(
          (r) => TAB_STATUSES[tab].includes(r.estado) && sectionConfig.matchesSpedizzione(r.spedizzione)
        )
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">{sectionConfig.label}</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            {isPrivileged
              ? "Navega mes a mes; cada dia se carga al desplegarlo."
              : "Viajes asignados, ordenados por fecha."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SectionTabs />
          <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
          {isPrivileged && sectionConfig.allowCreate && (
            <Link to={sectionConfig.newPath}>
              <Button className="w-auto px-5">Nuevo servicio</Button>
            </Link>
          )}
        </div>
      </div>

      <Alert>{error}</Alert>

      {!isPrivileged && records === null && !error && (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 border-line/20 border-t-line" />
        </div>
      )}

      {!isPrivileged && visibleRecords?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          {tab === "en_proceso"
            ? "No tienes registros en proceso."
            : "Todavia no tienes registros terminados."}
        </GlassCard>
      )}

      {isPrivileged ? (
        <GlassCard className="!p-0">
          <div className="flex items-center justify-between gap-2 px-5 py-4">
            <button
              type="button"
              onClick={() => setViewDate((v) => shiftMonth(v, -1))}
              className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
            >
              &larr; Mes anterior
            </button>
            <h2 className="text-[15px] font-semibold uppercase text-ink-100">
              {monthLabel(viewDate.year, viewDate.month)}
            </h2>
            <button
              type="button"
              onClick={() => setViewDate((v) => shiftMonth(v, 1))}
              className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
            >
              Mes siguiente &rarr;
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-line/10 px-5 pb-4 pt-3">
            {summary === null && (
              <div className="flex justify-center py-8">
                <Spinner className="h-5 w-5 border-line/20 border-t-line" />
              </div>
            )}

            {summaryDays?.length === 0 && (
              <p className="py-4 text-center text-[14px] text-ink-300">
                No hay servicios {tab === "en_proceso" ? "en proceso" : "terminados"} este mes.
              </p>
            )}

            {summaryDays?.map((day) => {
              const dayOpen = openDays.has(day.key);
              const loaded = dayRecords.get(day.key);
              const dayVisibleRecords = loaded
                ?.filter(
                  (r) =>
                    TAB_STATUSES[tab].includes(r.estado) && sectionConfig.matchesSpedizzione(r.spedizzione)
                )
                .sort((a, b) => driverName(a).localeCompare(driverName(b)));

              return (
                <div key={day.key} className="rounded-2xl glass-surface-sm">
                  <DisclosureHeader
                    open={dayOpen}
                    onClick={() => toggleDay(day)}
                    className="px-4 py-3 text-[14px] text-ink-100"
                  >
                    <span>
                      {dayLabel(day.date)}{" "}
                      <span className="text-ink-400">
                        ({day.count} servicio{day.count === 1 ? "" : "s"})
                      </span>
                    </span>
                  </DisclosureHeader>

                  {dayOpen && (
                    <div className="border-t border-line/10 pb-2">
                      {loadingDays.has(day.key) && (
                        <div className="flex justify-center py-6">
                          <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                        </div>
                      )}
                      {dayErrors.has(day.key) && <Alert>{dayErrors.get(day.key)}</Alert>}
                      {dayVisibleRecords && (
                        <div className="overflow-x-auto">
                          <div className="min-w-[720px]">
                            <CompactRowHeader />
                            <div className="flex flex-col gap-0.5 px-2">
                              {dayVisibleRecords.map((record) => (
                                <RecordRow key={record.id} record={record} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleRecords?.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
};
