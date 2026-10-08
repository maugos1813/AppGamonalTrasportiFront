import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { MapPinIcon } from "../ui/icons";
import { parseApiError } from "../../lib/api";
import { getRetornoRequest, setRetornoRequest } from "../../lib/paradas.api";

// Direccion de retorno por defecto para la estimacion por ruta (cuando no hay GPS ni del vehiculo ni del
// celular). Normalmente el vehiculo vuelve al lugar de espera de su area (Milano, Roma o Cargo City);
// esta direccion se usa cuando el area del servicio no se puede deducir.
export const RetornoCard = () => {
  const [settings, setSettings] = useState(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getRetornoRequest()
      .then((s) => {
        setSettings(s);
        setValue(s.configurada?.direccion ?? "");
      })
      .catch(() => {});
  }, []);

  const save = async (direccion) => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const s = await setRetornoRequest(direccion);
      setSettings(s);
      setValue(s.configurada?.direccion ?? "");
      setSaved(true);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;
  const current = settings.configurada?.direccion ?? null;
  const dirty = value.trim() !== (current ?? "");

  return (
    <section className="glass-surface flex flex-col gap-3 rounded-2xl px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
          <MapPinIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink-50">Retorno por defecto (estimacion sin GPS)</h2>
          <p className="mt-0.5 text-[13px] text-ink-300">
            Si no hay GPS del vehiculo ni del celular, el tiempo se estima con la hora de retiro, las paradas y el
            regreso. El vehiculo vuelve al lugar de espera de su area (Milano, Roma o Cargo City); esta direccion se
            usa cuando el area del servicio no se puede deducir.
          </p>
        </div>
      </div>
      <Alert>{error}</Alert>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          id="retorno-direccion"
          label="Direccion de retorno"
          placeholder={settings.porDefecto.direccion}
          className="min-w-[260px] flex-1"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
        />
        <Button className="sm:w-auto sm:px-5 sm:py-3 sm:text-[13px]" loading={saving} disabled={!dirty || !value.trim()} onClick={() => save(value.trim())}>
          Guardar
        </Button>
        {current && (
          <Button variant="ghost" className="sm:w-auto sm:px-4 sm:py-3 sm:text-[13px]" disabled={saving} onClick={() => save(null)}>
            Quitar
          </Button>
        )}
      </div>
      <p className="text-[12px] text-ink-400">
        {saved
          ? "Guardado."
          : current
            ? "Se usa la direccion configurada cuando el area no se puede deducir."
            : `Ahora se usa: ${settings.porDefecto.nombre} (${settings.porDefecto.direccion}).`}
      </p>
    </section>
  );
};
