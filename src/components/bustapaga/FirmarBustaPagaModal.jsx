import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { parseApiError } from "../../lib/api";
import { getBustaPagaFileRequest, signBustaPagaRequest } from "../../lib/bustaPaga.api";
import { periodoLabel } from "../../lib/bustaPaga";
import { SignaturePad } from "./SignaturePad";

// El chofer firma a mano que recibe su busta paga; recien despues se abre el PDF. La firma, la hora, el
// dispositivo y la huella del archivo quedan guardados como comprobante de recepcion.
export const FirmarBustaPagaModal = ({ busta, onClose, onSigned }) => {
  const padRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const handleSign = async () => {
    setError("");
    setSaving(true);
    // La pestaña del PDF se abre ya, en el toque; se completa cuando el servidor confirma la firma.
    const win = window.open("", "_blank");
    try {
      await signBustaPagaRequest(busta.id, padRef.current.toDataURL());
      const { url } = await getBustaPagaFileRequest(busta.id);
      if (win) win.location.href = url;
      onSigned(busta.id);
    } catch (err) {
      win?.close();
      setError(parseApiError(err).message);
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={saving ? undefined : onClose}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />
      <div className="glass-surface relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6">
        <div>
          <h2 className="text-[19px] font-semibold text-ink-50">Firma para ver tu busta paga</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            {periodoLabel(busta.anio, busta.mes)}. Firma con el dedo dentro del recuadro para confirmar que la recibes.
          </p>
        </div>

        <SignaturePad ref={padRef} onInkChange={setHasInk} />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => padRef.current?.clear()}
            disabled={saving}
            className="text-[13px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-50"
          >
            Borrar y firmar de nuevo
          </button>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-[13px] text-ink-200">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            Declaro haber recibido mi busta paga de {periodoLabel(busta.anio, busta.mes)}. Quedan registrados mi firma, la
            fecha y hora y mi dispositivo.
          </span>
        </label>

        <Alert>{error}</Alert>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button onClick={handleSign} loading={saving} disabled={!hasInk || !accepted} className="sm:w-auto sm:px-8">
            Firmar y ver busta paga
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving} className="sm:w-auto sm:px-8">
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
