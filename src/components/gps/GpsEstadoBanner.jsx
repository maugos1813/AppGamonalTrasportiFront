import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { AlertTriangleIcon, CheckCircleIcon } from "../ui/icons";
import { gpsEstadoTitle, isGpsFailing } from "../../lib/gps";
import { getGpsEstadoRequest } from "../../lib/gps.api";
import { formatRomeDateTime } from "../../lib/format";
import { startVisibleInterval } from "../../lib/polling";

// Estado del GPS de la flota para la oficina. Si OneSystec esta bloqueado o caido muestra un aviso rojo
// con lo que pasa y como se compensa (GPS del celular de los choferes que lo autorizaron). Con
// showOk tambien muestra una linea tranquila cuando todo anda bien.
export const GpsEstadoBanner = ({ showOk = false }) => {
  const [gps, setGps] = useState(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(
    (verificar = false) =>
      getGpsEstadoRequest({ verificar })
        .then(setGps)
        .catch(() => {}),
    []
  );

  useEffect(() => {
    load(false);
    return startVisibleInterval(() => load(false), 2 * 60 * 1000);
  }, [load]);

  const verify = async () => {
    setChecking(true);
    await load(true);
    setChecking(false);
  };

  if (!gps || gps.estado === "NO_CONFIGURADO") return null;

  const failing = isGpsFailing(gps);
  if (!failing && !showOk) return null;

  if (!failing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-500/20 bg-success-500/10 px-4 py-2.5 text-[13px] text-success-500">
        <span className="inline-flex items-center gap-2">
          <CheckCircleIcon className="h-4 w-4" />
          GPS de la flota conectado.
        </span>
        <button type="button" onClick={verify} disabled={checking} className="font-medium underline-offset-2 hover:underline disabled:opacity-60">
          {checking ? "Verificando..." : "Verificar ahora"}
        </button>
      </div>
    );
  }

  const { respaldo } = gps;
  return (
    <div
      role="alert"
      className={clsx("flex flex-col gap-3 rounded-2xl border border-danger-500/30 bg-danger-500/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between")}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-danger-500" />
        <div className="min-w-0 text-[13px] text-ink-100">
          <b className="block text-[14px] text-danger-500">{gpsEstadoTitle(gps)}</b>
          {gps.detalle && <span className="block">{gps.detalle}</span>}
          {gps.desde && <span className="block text-ink-300">Desde {formatRomeDateTime(gps.desde)}.</span>}
          <span className="mt-1 block text-ink-300">
            {respaldo?.habilitado
              ? `Mientras tanto, las paradas se calculan con el celular de los choferes que lo autorizaron (${respaldo.choferesConPermiso} de ${respaldo.choferesTotal}); son menos precisas y se marcan como "Celular". Si tampoco hay datos del celular, se estima por la ruta (retiro, paradas y retorno).`
              : "El respaldo con el celular esta desactivado: no hay paradas de este periodo."}
          </span>
        </div>
      </div>
      <Button variant="ghost" className="sm:w-auto sm:px-4 sm:py-2 sm:text-[13px]" loading={checking} onClick={verify}>
        Verificar ahora
      </Button>
    </div>
  );
};
