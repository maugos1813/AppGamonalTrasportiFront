import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { parseApiError } from "../../lib/api";
import { getConstanciaRequest } from "../../lib/bustaPaga.api";
import { periodoLabel } from "../../lib/bustaPaga";
import { formatDateTime } from "../../lib/format";

const ACCION_LABELS = {
  SUBIDA: "Enviada al chofer",
  REEMPLAZO: "Reemplazada antes de firmar",
  FIRMA: "Firmada por el chofer",
  VISTA: "Abierta por el chofer",
  VISTA_RRHH: "Abierta por Recursos Humanos",
};

const Row = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
    <span className="w-44 shrink-0 text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className="min-w-0 break-words text-[14px] text-ink-50">{children}</span>
  </div>
);

// Comprobante de recepcion de una busta paga firmada: quien, cuando, desde que dispositivo, la firma y la
// huella del archivo (SHA-256) que prueba que firmo ese documento exacto.
export const ConstanciaModal = ({ id, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getConstanciaRequest(id)
      .then((c) => !cancelled && setData(c))
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6">
        <h2 className="text-[19px] font-semibold text-ink-50">Comprobante de recepción</h2>
        <Alert>{error}</Alert>
        {!data && !error && <Spinner />}
        {data && (
          <>
            <div className="flex flex-col gap-2.5">
              <Row label="Chofer">{data.chofer}</Row>
              <Row label="Busta paga">{periodoLabel(data.anio, data.mes)}</Row>
              <Row label="Archivo">{data.nombreArchivo ?? "—"}</Row>
              <Row label="Enviada">
                {formatDateTime(data.subidaAt)} por {data.subidaPor}
              </Row>
              <Row label="Firmada">{formatDateTime(data.firmadaAt)} (hora del servidor)</Row>
              <Row label="IP">{data.firmaIp ?? "—"}</Row>
              <Row label="Dispositivo">{data.firmaDispositivo ?? "—"}</Row>
              <Row label="Huella del archivo">
                <code className="text-[12px]">{data.huellaArchivo}</code>
              </Row>
            </div>
            {data.firmaUrl && (
              <div>
                <span className="mb-1.5 block text-[12px] uppercase tracking-wide text-ink-400">Firma</span>
                <img src={data.firmaUrl} alt="Firma del chofer" className="max-h-44 rounded-xl border border-line/20 bg-white" />
              </div>
            )}
            <div>
              <span className="mb-1.5 block text-[12px] uppercase tracking-wide text-ink-400">Historial</span>
              <ul className="flex flex-col gap-1 text-[13px] text-ink-200">
                {data.accesos.map((a, index) => (
                  <li key={index}>
                    {formatDateTime(a.createdAt)} — {ACCION_LABELS[a.accion] ?? a.accion}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          {data && (
            <Button onClick={() => window.print()} className="sm:w-auto sm:px-8">
              Imprimir / guardar PDF
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="sm:w-auto sm:px-8">
            Cerrar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
