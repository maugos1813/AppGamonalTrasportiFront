import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { parseApiError } from "../../lib/api";
import { getTarifasKmRequest, setTarifasKmRequest } from "../../lib/finanzas.api";
import { CATEGORIA_VEHICULO_LABELS } from "../../lib/vehiculos";

const FIELDS = [
  { key: "AUTO_FURGONCINO", label: CATEGORIA_VEHICULO_LABELS.AUTO_FURGONCINO },
  { key: "H1_L1", label: CATEGORIA_VEHICULO_LABELS.H1_L1 },
  { key: "H2_L2", label: CATEGORIA_VEHICULO_LABELS.H2_L2 },
  { key: "CASONATO", label: CATEGORIA_VEHICULO_LABELS.CASONATO },
  { key: "DHL_AB", label: "DHL / DHL Roma / AB Service" },
];

// Precio por km (EUR/km) con el que se arma el costo de un servicio nuevo: Extras Piazza segun la categoria de su
// vehiculo; DHL y AB Service una sola tarifa (sobre los km del cliente x2). Cambiarlo no toca los servicios ya creados.
export const TarifasKmCard = ({ canEdit }) => {
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTarifasKmRequest()
      .then((t) => !cancelled && setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(t[f.key] ?? "")]))))
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload = Object.fromEntries(FIELDS.map((f) => [f.key, Number(String(values[f.key]).trim().replace(",", "."))]));
      if (Object.values(payload).some((v) => !Number.isFinite(v) || v < 0)) throw new Error("Escribe solo numeros (EUR por km).");
      const next = await setTarifasKmRequest(payload);
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(next[f.key])])));
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
        <h2 className="text-[16px] font-semibold text-ink-50">Tarifas por km</h2>
        <span className="text-[12px] text-ink-400">
          Precio por km automatico de los servicios nuevos. No cambia los que ya estan creados.
        </span>
      </div>
      <form onSubmit={handleSave} className="mt-3">
        <Alert>{error}</Alert>
        {values && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <TextField
                key={f.key}
                id={`tarifa-${f.key}`}
                label={`${f.label} (EUR/km)`}
                inputMode="decimal"
                value={values[f.key]}
                disabled={!canEdit}
                onChange={(e) => {
                  setSaved(false);
                  setValues((prev) => ({ ...prev, [f.key]: e.target.value.replace(/[^\d.,]/g, "") }));
                }}
              />
            ))}
          </div>
        )}
        <p className="mt-2 text-[12px] text-ink-400">
          Extras Piazza (Milano y Roma): km planificados x precio por km de la categoria del vehiculo. DHL, DHL Roma y AB
          Service: los km del cliente son de ida, se cuentan x2 y se pagan a la tarifa de DHL.
        </p>
        {canEdit ? (
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit" loading={saving} disabled={!values} className="sm:w-auto sm:px-6">
              Guardar tarifas
            </Button>
            {saved && <span className="text-[13px] text-success-500">Guardado</span>}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-ink-400">Solo un Admin puede cambiar las tarifas.</p>
        )}
      </form>
    </section>
  );
};
