import { useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { AlertTriangleIcon } from "../ui/icons";
import { TextField } from "../ui/TextField";
import { parseApiError } from "../../lib/api";
import { toRomeDateTimeInputValue } from "../../lib/format";
import { setRecepcionRequest } from "../../lib/horas.api";

// Servicio que otro chofer no pudo terminar y se le asigno a este: tiene que decir a que hora le
// dieron el paquete. Hasta entonces el servicio queda pendiente y no puede cargar sus horas. La misma
// tarjeta la usa la oficina para completarla en nombre del chofer.
export const RecepcionPaqueteCard = ({ record, onDone, className }) => {
  const [hora, setHora] = useState(() => toRomeDateTimeInputValue(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const from = record.origen?.chofer ? `${record.origen.chofer.nombre} ${record.origen.chofer.apellido}` : "otro chofer";

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await setRecepcionRequest(record.id, hora);
      onDone?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink-50">
            Se te asigno el servicio {record.origen?.codigo ?? record.codigo}
          </p>
          <p className="mt-0.5 text-[13px] text-ink-300">
            Lo dejo {from}. Indica a que hora te dieron el paquete: hasta que lo hagas el servicio queda
            pendiente y no puedes cargar tus horas.
          </p>
          <Alert>{error}</Alert>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <TextField
              id={`recepcion-${record.id}`}
              label="Hora en que recibiste el paquete"
              type="datetime-local"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full sm:w-64"
            />
            <Button className="sm:w-auto sm:px-5" loading={saving} disabled={!hora} onClick={handleSave}>
              Confirmar hora
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
