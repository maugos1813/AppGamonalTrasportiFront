import { useMemo, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { formatKmValue, repartirKm } from "../../lib/compactado";
import { ajustarKmViajeRequest } from "../../lib/records.api";

// La oficina reparte a mano los km reales del viaje entre sus servicios. La suma es el total del viaje (de ahi sale
// el pago por distancia). Atajos: repartir proporcional a lo planificado, o mandar todo el extra a un servicio.
export const KmRepartoEditor = ({ viaje, onClose, onSaved }) => {
  const servicios = viaje.servicios;
  const planOf = useMemo(() => servicios.map((s) => ({ id: s.id, plan: s.kmPlan ?? 0 })), [servicios]);
  const planificado = viaje.km?.planificado ?? 0;
  const [total, setTotal] = useState(String(viaje.km?.real ?? planificado));
  const [values, setValues] = useState(() =>
    Object.fromEntries(servicios.map((s) => [s.id, s.kmReal != null ? String(s.kmReal) : String(s.kmPlan ?? 0)]))
  );
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sum = Math.round(servicios.reduce((acc, s) => acc + (Number(values[s.id]) || 0), 0) * 10) / 10;
  const totalNum = Number(total) || 0;
  const mismatch = Math.abs(sum - totalNum) > 0.05;

  const apply = (km) => setValues(Object.fromEntries(km.map((r) => [r.id, String(r.km)])));
  const proporcional = () => apply(repartirKm({ total: totalNum, servicios: planOf }).km);
  const extraAqui = (id) => apply(repartirKm({ total: totalNum, servicios: planOf, extraIds: [id] }).km);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await ajustarKmViajeRequest(viaje.id, {
        reparto: servicios.map((s) => ({ id: s.id, km: Number(values[s.id]) || 0 })),
        nota: nota.trim(),
      });
      onSaved?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-line/10 bg-background/60 p-3.5">
      <h4 className="text-[13px] font-semibold text-ink-50">Reparto de km del viaje</h4>
      <p className="mt-0.5 text-[12px] text-ink-300">
        Planificado {formatKmValue(planificado)}. La suma de los servicios es el total del viaje: de ahí sale el pago por distancia.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          id="km-viaje-total"
          label="Total del viaje (km)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={proporcional}
            className="mb-2.5 text-[12px] font-medium text-accent-400 hover:text-accent-300"
          >
            Repartir proporcional a lo planificado
          </button>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {servicios.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-ink-50">{s.codigo} · {s.destinazione}</span>
              <span className="block text-[11px] text-ink-400">Planificado {formatKmValue(s.kmPlan)}</span>
            </span>
            <input
              aria-label={`Km de ${s.codigo}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={values[s.id]}
              onChange={(e) => setValues((prev) => ({ ...prev, [s.id]: e.target.value }))}
              className="w-24 rounded-lg border border-line/15 bg-transparent px-2.5 py-1.5 text-right text-[14px] text-ink-50"
            />
            <button
              type="button"
              onClick={() => extraAqui(s.id)}
              title="Todo el extra en este servicio; los demás hacen lo planificado"
              className="shrink-0 text-[11px] font-medium text-accent-400 hover:text-accent-300"
            >
              Extra aquí
            </button>
          </li>
        ))}
      </ul>

      <p className={mismatch ? "mt-2 text-[12px] text-warning-500" : "mt-2 text-[12px] text-ink-400"}>
        Suma {formatKmValue(sum)}
        {mismatch ? ` · no coincide con el total (${formatKmValue(totalNum)}): usa los atajos o corrige a mano` : ""}
      </p>

      <div className="mt-3">
        <Textarea
          id="km-viaje-nota"
          label="Motivo (opcional)"
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>

      <Alert>{error}</Alert>
      <div className="mt-3 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={saving} className="sm:w-auto sm:px-5 sm:py-1.5 sm:text-[13px]">
          Cancelar
        </Button>
        <Button onClick={save} loading={saving} disabled={mismatch} className="sm:w-auto sm:px-5 sm:py-1.5 sm:text-[13px]">
          Guardar reparto
        </Button>
      </div>
    </div>
  );
};
