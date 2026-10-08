import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarioMes } from "../../components/calendario/CalendarioMes";
import { PermisoCard } from "../../components/calendario/PermisoCard";
import { PermisoModal } from "../../components/calendario/PermisoModal";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { PageLoader } from "../../components/ui/PageLoader";
import { CalendarIcon, PlusIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { currentMonth } from "../../lib/finanzas";
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
  const [permisos, setPermisos] = useState([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalDate, setModalDate] = useState(undefined);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setError("");
    return Promise.all([getCalendarioRequest({ month }), listPermisosRequest({ estado: "TODAS" })])
      .then(([calendar, list]) => {
        setData(calendar);
        setPermisos(list);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
            <CalendarIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[26px] font-semibold leading-tight text-ink-50">Mi calendario</h1>
            <p className="mt-0.5 max-w-xl text-[14px] text-ink-300">
              Como va tu mes: dias trabajados, faltas y permisos.
            </p>
          </div>
        </div>
        <MonthSelector month={month} onChange={setMonth} allowFuture />
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <CalendarioMes data={data} selected={selected} onSelect={(dia) => setSelected(dia.fecha)} />
          {selectedDay && <DayDetail dia={selectedDay} onRequest={(fecha) => setModalDate(fecha)} />}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-ink-50">Mis solicitudes</h2>
        <Button className="sm:w-auto sm:px-4 sm:py-2 sm:text-[13px]" onClick={() => setModalDate("")}>
          <PlusIcon className="h-4 w-4" />
          Solicitar permiso
        </Button>
      </div>

      {permisos.length === 0 && data && (
        <p className="text-[13px] text-ink-300">
          Todavia no pediste ningun permiso. Si necesitas faltar, pidelo aqui con anticipacion.{" "}
          <Link to="/mis-horas" className="text-accent-400 hover:text-accent-300">
            Ver mis horas
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {pendientes.map((p) => (
          <PermisoCard
            key={p.id}
            permiso={p}
            actions={
              <Button
                variant="ghost"
                className="sm:w-auto sm:px-4 sm:py-1.5 sm:text-[13px]"
                onClick={() => setCancelId(p.id)}
              >
                Cancelar solicitud
              </Button>
            }
          />
        ))}
        {resueltos.map((p) => (
          <PermisoCard key={p.id} permiso={p} />
        ))}
      </div>

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
