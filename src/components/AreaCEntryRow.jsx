import { useState } from "react";
import { parseApiError } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { updateAreaCEntryRequest } from "../lib/vehicles.api";

// Una fila por entrada al Area C (targa + hora, ya completados) - el checkbox y el
// comprobante son ediciones locales hasta que se confirman con "Guardar" (un solo
// PATCH con los dos juntos, no uno por cada cambio - ver updateAreaCEntryRequest).
// Compartido entre MapPage (seccion "Area C") y ControlFlotaPage (historial completo).
export const AreaCEntryRow = ({ entry, onSaved }) => {
  const [pagado, setPagado] = useState(entry.pagado);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = pagado !== entry.pagado || file != null;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const formData = new FormData();
    formData.append("pagado", pagado);
    if (file) formData.append("comprobante", file);

    try {
      const updated = await updateAreaCEntryRequest(entry.id, formData);
      onSaved(updated);
      setFile(null);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-xl glass-surface-sm px-4 py-3 text-[13px] text-ink-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink-50">{entry.targa}</span>
        <span className="text-ink-400">{formatDateTime(entry.enteredAt)}</span>
      </div>

      {entry.comprobanteUrl && (
        <a
          href={entry.comprobanteUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-[12px] text-accent-400 hover:underline"
        >
          Ver comprobante
        </a>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={pagado}
            onChange={(e) => setPagado(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          Pagado
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-ink-300">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="rounded-lg glass-input px-2.5 py-1 text-[12px]">
            {file?.name ?? (entry.comprobanteUrl ? "Reemplazar comprobante" : "Subir comprobante")}
          </span>
        </label>
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent-500 px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        )}
      </div>

      {error && <p className="mt-1.5 text-[12px] text-danger-500">{error}</p>}
    </li>
  );
};
