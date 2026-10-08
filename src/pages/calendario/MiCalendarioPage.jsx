import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PermisoCard } from "../../components/calendario/PermisoCard";
import { CalendarioChofer } from "../../components/chofer/CalendarioChofer";
import { CalendarCheckArt } from "../../components/chofer/illustrations";
import { PermisoModal } from "../../components/calendario/PermisoModal";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { PageLoader } from "../../components/ui/PageLoader";
import { CalendarIcon, ChevronRightIcon, FileTextIcon, PlusIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { currentMonth, shiftMonth } from "../../lib/finanzas";
import { formatDateOnly } from "../../lib/format";
import { DIA_ESTADOS, permisoTipoLabel } from "../../lib/permisos";
import { deletePermisoRequest, getCalendarioRequest, listPermisosRequest } from "../../lib/permisos.api";

const DayDetail = ({ dia, onRequest }) => {
  const config = DIA_ESTADOS[dia.estado];
  const canRequest = ["NO_TRABAJADO", "FUTURO", "HOY", "PROGRAMADO"].includes(dia.estado) && !dia.completo;
  return (
    <div className="glass-surface-sm flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
      <div className="min-w-0 text-[13px] text-ink-200">
        <b className="text-ink-50">{formatDateOnly(dia.fecha)}</b>
        {config.label && <> &middot; {config.label}</>}
        {dia.servicios > 0 && (
          <> &middot; {dia.servicios} {dia.servicios === 1 ? "servicio" : "servicios"}</>
        )}
        {dia.completo && !dia.permiso && (
          <span className="block text-danger-500">
            Este dia ya no admite mas permisos. Elige otra fecha (la enfermedad si se puede registrar).
          </span>
        )}
        {dia.permiso && (
          <span className="block text-ink-300">
            {permisoTipoLabel(dia.permiso.tipo)}: {dia.permiso.motivo}
          </span>
        )}
      </div>
      {canRequest && (
        <Button className="sm:w-auto sm:px-4 sm:py-2 sm:text-[13px]" variant="ghost" onClick={() => onRequest(dia.fecha)}>
          Pedir permiso este dia
        </Button>
      )}
    </div>
  );
};

// "Mi calendario" (chofer): cuantos dias trabajo en el mes, cuales falto, cuales estan justificados,
// y desde aqui mismo puede pedir permisos con anticipacion.
export const MiCalendarioPage = () => {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [prev, setPrev] = useState(null);
  const solicitudesRef = useRef(null);
  const [permisos, setPermisos] = useState([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalDate, setModalDate] = useState(undefined);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setError("");
    // El mes anterior es solo para comparar: si falla, el calendario se ve igual.
    const previous = getCalendarioRequest({ month: shiftMonth(month, -1) }).catch(() => null);
    return Promise.all([getCalendarioRequest({ month }), listPermisosRequest({ estado: "TODAS" }), previous])
      .then(([calendar, list, before]) => {
        setData(calendar);
        setPermisos(list);
        setPrev(before);
      })
      .catch((err) => setError(parseApiError(err).message));
  }, [month]);

  useEffect(() => {
    setData(null);
    setSelected(null);
    load();
  }, [load]);

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await deletePermisoRequest(cancelId);
      setCancelId(null);
      await load();
    } catch (err) {
      setError(parseApiError(err).message);
      setCancelId(null);
    } finally {
      setCancelling(false);
    }
  };

  const selectedDay = data?.days.find((d) => d.fecha === selected);
  const pendientes = permisos.filter((p) => p.estado === "PENDIENTE");
  const resueltos = permisos.filter((p) => p.estado !== "PENDIENTE").slice(0, 8);

  const requestButton = (
    <button
      type="button"
      onClick={() => setModalDate("")}
      className="flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-3 text-[14px] font-semibold text-brand-foreground shadow-[0_8px_24px_-10px_var(--brand)] transition hover:brightness-105 active:scale-[0.98]"
    >
      <PlusIcon className="h-4 w-4" />
      Solicitar permiso
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
            <CalendarIcon className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-ink-50">Mi calendario</h1>
            <p className="mt-0.5 max-w-xl text-[14px] text-ink-300">Revisa tus dias trabajados, faltas y permisos.</p>
          </div>
        </div>
        <MonthSelector month={month} onChange={setMonth} allowFuture />
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <CalendarioChofer data={data} prev={prev} selected={selected} onSelect={(dia) => setSelected(dia.fecha)} />
          {selectedDay && <DayDetail dia={selectedDay} onRequest={(fecha) => setModalDate(fecha)} />}
        </>
      )}

      {pendientes.length > 0 && (
        <div className="glass-surface-sm flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <p className="text-[13px] text-ink-50">
              Tienes {pendientes.length} {pendientes.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"} de permiso.
              <span className="block text-[12px] text-ink-300">Esperando la respuesta de la oficina.</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => solicitudesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex items-center gap-1.5 rounded-full border border-accent-400/50 px-4 py-2 text-[13px] font-medium text-accent-400 transition hover:bg-accent-500/10"
          >
            Ver permisos
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <section ref={solicitudesRef} className="glass-surface scroll-mt-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400">
              <FileTextIcon className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-[19px] font-semibold text-ink-50">Mis solicitudes</h2>
              <p className="text-[13px] text-ink-300">Solicitudes de permisos, dias libres y justificativos.</p>
            </div>
          </div>
          {requestButton}
        </div>

        {permisos.length === 0 && data ? (
          <div className="flex flex-col items-center px-2 pb-2 pt-6 text-center">
            <CalendarCheckArt className="h-24 w-32 text-accent-400" />
            <p className="mt-2 text-[15px] font-medium text-ink-50">No tienes solicitudes recientes</p>
            <p className="text-[13px] text-ink-300">Cuando hagas una solicitud, la veras aqui.</p>
            <Link to="/mis-horas" className="mt-3 text-[13px] text-accent-400 hover:text-accent-300">
              Ver mis horas &rarr;
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pendientes.map((p) => (
              <PermisoCard
                key={p.id}
                permiso={p}
                actions={
                  <button
                    type="button"
                    onClick={() => setCancelId(p.id)}
                    className="rounded-full border border-line/20 px-4 py-1.5 text-[13px] font-medium text-ink-50 transition hover:bg-line/10"
                  >
                    Cancelar solicitud
                  </button>
                }
              />
            ))}
            {resueltos.map((p) => (
              <PermisoCard key={p.id} permiso={p} />
            ))}
          </div>
        )}
      </section>

      {modalDate !== undefined && (
        <PermisoModal
          initialDate={modalDate}
          onClose={() => setModalDate(undefined)}
          onDone={() => load()}
        />
      )}

      <ConfirmModal
        open={Boolean(cancelId)}
        title="Cancelar la solicitud"
        description="Se quita de la lista. Si la necesitas otra vez tendras que pedirla de nuevo (con una fecha y hora nuevas)."
        confirmLabel="Cancelar solicitud"
        cancelLabel="Volver"
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setCancelId(null)}
      />
    </div>
  );
};
