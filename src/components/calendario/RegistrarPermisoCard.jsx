import { forwardRef, useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { PERMISO_TIPOS_OFICINA } from "../../lib/permisos";
import { createPermisoRequest } from "../../lib/permisos.api";

// Formulario en linea (oficina) para cargar un permiso o dia libre de un chofer. Queda aprobado
// directamente. "date" prellena la fecha (al tocar un dia del calendario).
export const RegistrarPermisoCard = forwardRef(({ driverId, date, onDone }, ref) => {
  const [tipo, setTipo] = useState("PERMISO");
  const [desde, setDesde] = useState(date ?? "");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (date) setDesde(date);
  }, [date]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!desde) return setError("Elige la fecha");
    setSaving(true);
    try {
      const result = await createPermisoRequest({
        driverId,
        tipo,
        fechaDesde: desde,
        ...(hasta ? { fechaHasta: hasta } : {}),
        motivo,
      });
      setNotice(
        result.excedeTope
          ? `Registrado. Ojo: ${result.excedeTope.dias.join(", ")} supera el tope de ${result.excedeTope.tope} permisos.`
          : "Registrado en el calendario."
      );
      setMotivo("");
      setHasta("");
      onDone?.(result);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section ref={ref} className="glass-surface rounded-2xl p-4 sm:p-5">
      <h2 className="text-[16px] font-semibold text-ink-50">Registrar permiso</h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <Alert>{error}</Alert>
        <Alert variant="success">{notice}</Alert>
        <Select
          id="reg-tipo"
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          options={PERMISO_TIPOS_OFICINA}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField id="reg-desde" label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <TextField
            id="reg-hasta"
            label="Hasta"
            type="date"
            min={desde || undefined}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <Textarea
          id="reg-motivo"
          label={tipo === "DESCANSO" ? "Nota (opcional)" : "Motivo"}
          placeholder="Ej. motivo de la solicitud..."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <Button type="submit" loading={saving}>
          Guardar
        </Button>
        <p className="rounded-xl bg-line/5 px-3 py-2 text-[12px] text-ink-300">
          Los permisos cargados por la oficina se aprueban automaticamente.
        </p>
      </form>
    </section>
  );
});

RegistrarPermisoCard.displayName = "RegistrarPermisoCard";
