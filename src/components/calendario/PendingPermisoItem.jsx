import { useState } from "react";
import { PermisoCard } from "./PermisoCard";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { reviewPermisoRequest } from "../../lib/permisos.api";

const SMALL = "sm:w-auto sm:px-4 sm:py-1.5 sm:text-[13px]";

// Solicitud pendiente con Aprobar / Rechazar. Rechazar pide el motivo (lo ve el chofer). Si aprobarla
// supera el tope de permisos por dia, pide confirmar.
export const PendingPermisoItem = ({ permiso, showDriver = true, onResolved, onError }) => {
  const [rejecting, setRejecting] = useState(false);
  const [respuesta, setRespuesta] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);
  const excede = permiso.ocupacion?.excede;

  const review = async (accion, forzar = false) => {
    setBusy(true);
    onError("");
    try {
      await reviewPermisoRequest(permiso.id, {
        accion,
        respuesta: respuesta.trim() || undefined,
        ...(forzar ? { forzar: true } : {}),
      });
      setConfirmForce(false);
      onResolved();
    } catch (err) {
      const parsed = parseApiError(err);
      // El tope se paso entre que se abrio la pantalla y se aprobo: se pide confirmar.
      if (parsed.fieldErrors?.codigo === "TOPE") setConfirmForce(true);
      else onError(parsed.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = () => (excede ? setConfirmForce(true) : review("APROBAR"));

  return (
    <div className="flex flex-col gap-2">
      <PermisoCard
        permiso={permiso}
        showDriver={showDriver}
        actions={
          rejecting ? (
            <div className="flex w-full flex-col gap-2">
              <Textarea
                id={`rechazo-${permiso.id}`}
                label="Motivo del rechazo (lo ve el chofer)"
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="ghost" className={SMALL} disabled={busy} onClick={() => setRejecting(false)}>
                  Volver
                </Button>
                <Button variant="danger" className={SMALL} loading={busy} onClick={() => review("RECHAZAR")}>
                  Rechazar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button className={SMALL} loading={busy} onClick={approve}>
                Aprobar
              </Button>
              <Button variant="ghost" className={SMALL} disabled={busy} onClick={() => setRejecting(true)}>
                Rechazar
              </Button>
            </>
          )
        }
      />
      {excede && (
        <p className="px-1 text-[12px] text-warning-500">
          Ojo: en esas fechas ya hay {permiso.ocupacion.maxAprobados} permisos aprobados (tope {permiso.ocupacion.tope}).
        </p>
      )}
      <ConfirmModal
        open={confirmForce}
        title="Superar el tope de permisos"
        description={`Ese dia ya hay ${permiso.ocupacion?.maxAprobados ?? "el maximo de"} permisos aprobados (tope ${
          permiso.ocupacion?.tope ?? ""
        }). Si lo apruebas, se supera. ¿Aprobar igual?`}
        confirmLabel="Aprobar igual"
        cancelLabel="Volver"
        loading={busy}
        onConfirm={() => review("APROBAR", true)}
        onCancel={() => setConfirmForce(false)}
      />
    </div>
  );
};
