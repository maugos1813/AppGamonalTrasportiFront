import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { parseApiError } from "../../lib/api";
import { setMetasConfigRequest } from "../../lib/metas.api";
import { NIVELES_CHOFER } from "../../lib/roles";

// Meta mensual de km por nivel. La define el Admin a mano; el Responsable solo la ve.
export const MetasKmCard = ({ metas, canEdit, onSaved }) => {
  const [values, setValues] = useState({ NOVATO: "", MASTER: "", SENIOR: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!metas) return;
    setValues(Object.fromEntries(NIVELES_CHOFER.map((n) => [n.value, metas[n.value] == null ? "" : String(metas[n.value])])));
  }, [metas]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload = Object.fromEntries(
        NIVELES_CHOFER.map((n) => {
          const raw = String(values[n.value]).trim().replace(",", ".");
          return [n.value, raw === "" ? null : Number(raw)];
        })
      );
      if (Object.values(payload).some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
        throw new Error("Escribe solo numeros (km por mes).");
      }
      onSaved(await setMetasConfigRequest(payload));
      setSaved(true);
    } catch (err) {
      setError(err.message && !err.response ? err.message : parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-surface rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-ink-50">Meta de km por nivel</h2>
        <span className="text-[12px] text-ink-400">Por mes. Cada chofer ve su avance contra la meta de su nivel.</span>
      </div>
      <form onSubmit={handleSave} className="mt-3">
        <Alert>{error}</Alert>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {NIVELES_CHOFER.map((n) => (
            <TextField
              key={n.value}
              id={`meta-${n.value}`}
              label={n.label}
              inputMode="decimal"
              placeholder="Sin definir"
              value={values[n.value]}
              disabled={!canEdit}
              onChange={(e) => {
                setSaved(false);
                setValues((prev) => ({ ...prev, [n.value]: e.target.value.replace(/[^\d.,]/g, "") }));
              }}
            />
          ))}
        </div>
        {canEdit ? (
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit" loading={saving} className="sm:w-auto sm:px-6">
              Guardar metas
            </Button>
            {saved && <span className="text-[13px] text-success-500">Guardado</span>}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-ink-400">Solo un Admin puede cambiar las metas.</p>
        )}
      </form>
    </section>
  );
};
