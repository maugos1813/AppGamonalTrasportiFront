import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { listRecordsRequest } from "../../lib/records.api";

const TAB_OPTIONS = [
  { value: "en_proceso", label: "En proceso" },
  { value: "terminados", label: "Terminados" },
];

const TAB_STATUSES = {
  en_proceso: EN_PROCESO_STATUSES,
  terminados: TERMINADOS_STATUSES,
};

// Claves de agrupacion en horario local (evita el corrimiento de dia/mes que da UTC).
const monthKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const dayKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthLabel = (value) => new Date(value).toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase();
const dayLabel = (value) =>
  new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const driverName = (record) =>
  record.driver ? `${record.driver.nombre} ${record.driver.apellido}` : "Sin chofer asignado";

// Agrupa por mes de creacion > dia de creacion (mas reciente primero); dentro de
// cada dia, los servicios quedan en una sola lista ordenada por chofer (columna
// "Chofer" de la fila compacta), para que el OWNER/ADMIN pueda navegar como un
// calendario y ubicar rapido los registros de un dia y de un chofer en particular.
// Solo aparecen meses/dias que tengan al menos un registro.
const groupByMonthDay = (list) => {
  const months = new Map();

  for (const record of list) {
    const mKey = monthKey(record.createdAt);
    if (!months.has(mKey)) months.set(mKey, { date: record.createdAt, days: new Map() });
    const month = months.get(mKey);

    const dKey = dayKey(record.createdAt);
    if (!month.days.has(dKey)) month.days.set(dKey, { date: record.createdAt, records: [] });
    month.days.get(dKey).records.push(record);
  }

  return Array.from(months.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, month]) => ({
      key,
      date: month.date,
      days: Array.from(month.days.entries())
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([dKey, day]) => ({
          key: dKey,
          date: day.date,
          records: [...day.records].sort((a, b) => driverName(a).localeCompare(driverName(b))),
        })),
    }));
};

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
    <GlassCard className="transition-colors hover:bg-white/[0.08]">
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
    className="flex h-[50px] items-center gap-3 rounded-xl px-4 text-[12px] text-ink-200 transition-colors hover:bg-white/[0.08]"
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

export const RecordsListPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("en_proceso");
  const [openMonths, setOpenMonths] = useState(() => new Set([monthKey(new Date())]));
  const [openDays, setOpenDays] = useState(() => new Set());

  const toggleSet = (setter) => (key) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleMonth = toggleSet(setOpenMonths);
  const toggleDay = toggleSet(setOpenDays);

  // Fuerza un re-render cada minuto para que "tiempo restante antes de vencer" no quede desactualizado.
  const [, setTick] = useState(0);
  useEffect(() => {
    const intervalId = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
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
  }, []);

  const visibleRecords = records?.filter((r) => TAB_STATUSES[tab].includes(r.estado));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Mis registros</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            {isPrivileged
              ? "Agrupados por mes, dia y chofer de creacion."
              : "Viajes asignados, ordenados por fecha."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
          {isPrivileged && (
            <Link to="/records/new">
              <Button className="w-auto px-5">Nuevo servicio</Button>
            </Link>
          )}
        </div>
      </div>

      <Alert>{error}</Alert>

      {records === null && !error && (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 border-white/20 border-t-white" />
        </div>
      )}

      {visibleRecords?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          {tab === "en_proceso"
            ? "No tienes registros en proceso."
            : "Todavia no tienes registros terminados."}
        </GlassCard>
      )}

      {isPrivileged ? (
        <div className="flex flex-col gap-3">
          {groupByMonthDay(visibleRecords ?? []).map((month) => {
            const monthOpen = openMonths.has(month.key);
            return (
              <GlassCard key={month.key} className="!p-0">
                <DisclosureHeader
                  open={monthOpen}
                  onClick={() => toggleMonth(month.key)}
                  className="px-5 py-4 text-[15px] font-semibold text-ink-100"
                >
                  {monthLabel(month.date)}
                </DisclosureHeader>

                {monthOpen && (
                  <div className="flex flex-col gap-2 border-t border-white/10 px-5 pb-4 pt-3">
                    {month.days.map((day) => {
                      const dayOpen = openDays.has(day.key);
                      return (
                        <div key={day.key} className="rounded-2xl glass-surface-sm">
                          <DisclosureHeader
                            open={dayOpen}
                            onClick={() => toggleDay(day.key)}
                            className="px-4 py-3 text-[14px] text-ink-100"
                          >
                            <span>
                              {dayLabel(day.date)}{" "}
                              <span className="text-ink-400">
                                ({day.records.length} servicio{day.records.length === 1 ? "" : "s"})
                              </span>
                            </span>
                          </DisclosureHeader>

                          {dayOpen && (
                            <div className="overflow-x-auto border-t border-white/10 pb-2">
                              <div className="min-w-[720px]">
                                <CompactRowHeader />
                                <div className="flex flex-col gap-0.5 px-2">
                                  {day.records.map((record) => (
                                    <RecordRow key={record.id} record={record} />
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
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
