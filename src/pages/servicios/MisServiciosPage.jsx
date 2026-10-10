import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ServicioPendienteRow } from "../../components/chofer/ServiciosPendientesCard";
import { StatusPill } from "../../components/chofer/StatusPill";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { CheckCircleIcon, ChevronDownIcon, ChevronRightIcon } from "../../components/ui/icons";
import { useCerrarServicio } from "../../hooks/useCerrarServicio";
import { parseApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { isPending, sortPending } from "../../lib/pendientes";
import { listRecordsRequest } from "../../lib/records.api";

const ROME = { timeZone: "Europe/Rome" };
const dayKey = (value) => new Date(value).toLocaleDateString("en-CA", ROME);
const monthKey = (value) => dayKey(value).slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
};

// Acordeon: el contenido solo se arma al abrirlo, asi un historial largo no pesa en el celular.
const Acordeon = ({ title, count, badge, badgeTone, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="glass-surface overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-[16px] font-semibold text-ink-50">{title}</span>
          <span className="shrink-0 rounded-full bg-line/10 px-2.5 py-0.5 text-[12px] font-medium text-ink-300">{count}</span>
          {badge && (
            <span
              className={clsx(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                badgeTone === "danger" ? "bg-danger-500/15 text-danger-500" : "bg-success-500/15 text-success-500"
              )}
            >
              {badge}
            </span>
          )}
        </span>
        <ChevronDownIcon className={clsx("h-5 w-5 shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-line/10">{children}</div>}
    </section>
  );
};

// Servicio ya resuelto: fila compacta que abre el detalle.
const ServicioRow = ({ service }) => {
  const location = useLocation();
  return (
    <Link
      to={`/records/${service.id}`}
      state={{ backgroundLocation: location }}
      className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-line/[0.05]"
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug text-ink-50">
          {service.codigo} <span className="font-normal text-ink-400">—</span> {service.destinazione}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-400">
          {formatDateTime(service.fechaRetiro ?? service.fechaServicio)}
          {service.vehicle?.targa ? ` · ${service.vehicle.targa}` : ""}
        </span>
        {service.jornada?.estado && <HorasEstadoChip estado={service.jornada.estado} className="mt-1.5" />}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <StatusPill estado={service.estado} />
        <ChevronRightIcon className="h-4 w-4 text-ink-400" />
      </span>
    </Link>
  );
};

const Stat = ({ label, value, tone }) => (
  <div className="glass-surface-sm rounded-2xl px-3 py-3 text-center">
    <span
      className={clsx(
        "block text-[24px] font-semibold leading-none",
        tone === "danger" ? "text-danger-500" : tone === "success" ? "text-success-500" : "text-ink-50"
      )}
    >
      {value}
    </span>
    <span className="mt-1 block text-[11px] font-medium uppercase tracking-normal text-ink-300">{label}</span>
  </div>
);

// Todos los servicios del chofer, ordenados para el celular: primero lo pendiente (con su boton para resolverlo)
// y despues el historial en un acordeon por mes.
export const MisServiciosPage = () => {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    listRecordsRequest()
      .then(setRecords)
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useCerrarServicio(load);

  const { pending, months, stats } = useMemo(() => {
    const list = records ?? [];
    const pend = list.filter(isPending).sort(sortPending);
    const pendingIds = new Set(pend.map((r) => r.id));
    const byMonth = new Map();
    for (const r of list) {
      if (pendingIds.has(r.id)) continue;
      const key = monthKey(r.fechaServicio);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(r);
    }
    const sorted = [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => [key, items.sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio))]);
    const today = dayKey(new Date());
    return {
      pending: pend,
      months: sorted,
      stats: {
        hoy: list.filter((r) => dayKey(r.fechaServicio) === today).length,
        mes: list.filter((r) => monthKey(r.fechaServicio) === today.slice(0, 7)).length,
      },
    };
  }, [records]);

  if (error && !records) return <Alert>{error}</Alert>;
  if (!records) return <PageLoader />;

  const currentMonth = dayKey(new Date()).slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink-50">Mis servicios</h1>
        <p className="mt-0.5 text-[13px] text-ink-300">Lo pendiente primero, y tu historial por mes.</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Pendientes" value={pending.length} tone={pending.length > 0 ? "danger" : "success"} />
        <Stat label="Hoy" value={stats.hoy} />
        <Stat label="Este mes" value={stats.mes} />
      </div>

      <Alert>{error}</Alert>

      <Acordeon
        title="Pendientes"
        count={pending.length}
        badge={pending.length === 0 ? "Todo al día" : null}
        badgeTone="success"
        defaultOpen={pending.length > 0}
      >
        {pending.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-4 text-[14px] text-ink-300">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-success-500" />
            No tienes nada pendiente.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-line/10">
            {pending.map((service) => (
              <div key={service.id} className="px-4 py-4">
                <ServicioPendienteRow
                  service={service}
                  opening={actions.openingId === service.id}
                  uploading={actions.uploadingId === service.id}
                  error={actions.errors[service.id]}
                  onClose={actions.onClose(service.id)}
                  onUpload={actions.onUpload(service.id)}
                />
              </div>
            ))}
          </div>
        )}
      </Acordeon>

      {months.length === 0 && pending.length === 0 && (
        <p className="px-1 text-[14px] text-ink-300">Todavía no tienes servicios.</p>
      )}

      {months.map(([key, items]) => (
        <Acordeon key={key} title={monthLabel(key)} count={items.length} defaultOpen={key === currentMonth}>
          <div className="flex flex-col divide-y divide-line/10">
            {items.map((service) => (
              <ServicioRow key={service.id} service={service} />
            ))}
          </div>
        </Acordeon>
      ))}

      {actions.modal}
    </div>
  );
};
