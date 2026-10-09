import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CheckCircleIcon } from "../ui/icons";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { formatRomeDateTime, toRomeDateTimeInputValue } from "../../lib/format";
import { PAY_RULES_FALLBACK } from "../../lib/finanzas";
import { formatHours, previewShift } from "../../lib/horas";
import { submitHorasRequest } from "../../lib/horas.api";

const MIN_CHIPS = [0, 15, 30, 45, 60];

const MinutesField = ({ id, label, hint, value, onChange }) => (
  <div>
    <TextField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min="0"
      step="5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <div className="mt-2 flex flex-wrap gap-1.5">
      {MIN_CHIPS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(String(m))}
          className={
            Number(value) === m
              ? "rounded-full bg-accent-500/20 px-2.5 py-1 text-[12px] font-medium text-accent-400"
              : "rounded-full glass-surface-sm px-2.5 py-1 text-[12px] text-ink-300 hover:bg-line/10"
          }
        >
          {m === 0 ? "Ninguna" : `${m} min`}
        </button>
      ))}
    </div>
    {hint && <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>}
  </div>
);

// Cierre de un servicio por el chofer: hora de inicio y fin de su jornada, espera y pausa. El
// sistema reparte lo trabajado entre horas de dia y de noche (no hay que calcularlo a mano). Al
// enviar, el servicio queda entregado y las horas esperan la aprobacion del responsable.
// "reglas": tarifas vigentes (GET /finanzas/pagos) para la estimacion; si no estan, se muestran
// solo las horas.
export const CerrarServicioModal = ({ record, reglas, onClose, onDone }) => {
  const jornada = record.jornada ?? {};
  // En un servicio recibido de otro chofer la jornada arranca, por defecto, cuando recibio el paquete.
  const [inicio, setInicio] = useState(
    toRomeDateTimeInputValue(
      jornada.inicio ?? (record.origen ? record.traspasoHora : null) ?? record.fechaRetiro ?? record.fechaServicio
    )
  );
  const [fin, setFin] = useState(toRomeDateTimeInputValue(jornada.fin ?? new Date()));
  const [esperaMin, setEsperaMin] = useState(String(jornada.esperaMin ?? 0));
  const [pausaMin, setPausaMin] = useState(String(jornada.pausaMin ?? 0));
  const [km, setKm] = useState(record.kilometrosReales ?? "");
  const [comentarios, setComentarios] = useState(record.comentarios ?? "");
  // Termino sin pasar por el lugar de espera (por ejemplo fue directo a casa): su fin es la hora de llegada.
  const [finFueraDeBase, setFinFueraDeBase] = useState(Boolean(jornada.finFueraDeBase));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving, onClose]);

  const preview = useMemo(
    () => previewShift({ inicio, fin, esperaMin, pausaMin }, reglas ?? PAY_RULES_FALLBACK),
    [inicio, fin, esperaMin, pausaMin, reglas]
  );
  // Coherencia con el traspaso: quien recibe empieza a mas tardar cuando recibio el paquete; quien lo
  // entrego termina a partir de la entrega (vuelve al lugar de espera).
  const handover = record.origen ? record.traspasoHora : record.relevo?.traspasoHora;
  const handoverValue = handover ? toRomeDateTimeInputValue(handover) : null;
  let handoverError = "";
  if (handoverValue && inicio && fin) {
    if (record.origen && inicio > handoverValue) {
      handoverError = "Tu jornada tiene que empezar a la hora en que recibiste el paquete, o antes.";
    }
    if (record.relevo && fin < handoverValue) {
      handoverError = "Tu jornada no puede terminar antes de entregar el paquete: termina cuando vuelves al lugar de espera.";
    }
  }
  const canSubmit = preview.totalMin != null && !preview.error && !handoverError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await submitHorasRequest(record.id, {
        inicio,
        fin,
        esperaMin: Number(esperaMin) || 0,
        pausaMin: Number(pausaMin) || 0,
        ...(km !== "" ? { kilometrosReales: Number(km) } : {}),
        ...(comentarios.trim() ? { comentarios: comentarios.trim() } : {}),
        entregado: true,
        finFueraDeBase,
      });
      setSent(true);
      onDone?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />

      <div className="glass-surface relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircleIcon className="h-12 w-12 text-success-500" />
            <h2 className="text-[19px] font-semibold text-ink-50">Servicio enviado</h2>
            <p className="text-[14px] text-ink-300">
              Tus horas quedaron en revision. Cuando el responsable las apruebe, cuentan para tu pago.
            </p>
            <div className="mt-2 w-full rounded-2xl bg-warning-500/10 px-4 py-3 text-left">
              <p className="text-[14px] font-medium text-ink-50">¿Pasaste por algun peaje sin pagar?</p>
              <p className="mt-0.5 text-[13px] text-ink-300">
                Sube el aviso de mancato pagamento ahora para no olvidarte.
              </p>
              <Link
                to="/finanzas/mancato/new"
                className="mt-2 inline-block text-[13px] font-semibold text-accent-400 hover:text-accent-300"
              >
                Subir mancato pagamento &rarr;
              </Link>
            </div>
            <Button className="mt-2" onClick={onClose}>
              Listo
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <h2 className="text-[19px] font-semibold text-ink-50">Terminar servicio</h2>
              <p className="mt-0.5 text-[13px] text-ink-300">
                {record.codigo} &middot; {record.destinazione}
              </p>
            </div>

            {jornada.estado === "DEVUELTAS" && jornada.nota && (
              <div className="rounded-xl bg-danger-500/10 px-4 py-3 text-[13px] text-ink-100">
                <b className="text-danger-500">Devuelto por el responsable:</b> {jornada.nota}
              </div>
            )}

            {handoverValue && (
              <div className="rounded-xl bg-accent-500/10 px-4 py-3 text-[13px] text-ink-200">
                {record.origen
                  ? `Recibiste el paquete a las ${formatRomeDateTime(record.traspasoHora)}. Si saliste antes para encontrarte con el otro chofer, pon tu hora de salida.`
                  : `Le diste el paquete a ${record.relevo.chofer.nombre} a las ${formatRomeDateTime(record.traspasoHora ?? record.relevo.traspasoHora)}. Tu jornada sigue hasta que vuelves al lugar de espera.`}
              </div>
            )}

            <Alert>{error || handoverError}</Alert>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="horas-inicio"
                label="Inicio de tu jornada"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                required
              />
              <TextField
                id="horas-fin"
                label="Fin de tu jornada"
                type="datetime-local"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="flex items-start gap-2.5 text-[14px] text-ink-100">
                <input
                  type="checkbox"
                  checked={finFueraDeBase}
                  onChange={(e) => setFinFueraDeBase(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-line/20 bg-transparent accent-accent-500"
                />
                ¿Terminaste sin pasar por el lugar de espera (por ejemplo, fuiste a casa)?
              </label>
              {finFueraDeBase && (
                <p className="mt-1.5 pl-6.5 text-[12px] text-ink-400">
                  Pon como fin la hora en que llegaste. Se te paga hasta que llegas, con un maximo igual a lo
                  que habrias tardado en volver al lugar de espera desde tu ultima entrega.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <MinutesField
                id="horas-espera"
                label="Espera (minutos)"
                hint="Tiempo esperando al cliente dentro de tu jornada. Se paga aparte."
                value={esperaMin}
                onChange={setEsperaMin}
              />
              <MinutesField
                id="horas-pausa"
                label="Pausa no trabajada (minutos)"
                hint="Comida u otra parada que no fue trabajo. No se paga."
                value={pausaMin}
                onChange={setPausaMin}
              />
            </div>

            <TextField
              id="horas-km"
              label="Km reales (opcional)"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
            <Textarea
              id="horas-comentarios"
              label="Comentarios (opcional)"
              rows={2}
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
            />

            <div className="rounded-2xl glass-surface-sm px-4 py-3">
              {preview.error ? (
                <p className="text-[13px] text-danger-500">{preview.error}</p>
              ) : canSubmit ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] text-ink-300">
                      Dia <b className="text-ink-50">{formatHours(preview.horasDia)}</b> &middot; Noche{" "}
                      <b className="text-ink-50">{formatHours(preview.horasNoche)}</b> &middot; Espera{" "}
                      <b className="text-ink-50">{formatHours(preview.esperaHoras)}</b>
                    </span>
                    {preview.pago != null && (
                      <span className="text-[15px] font-semibold text-ink-50">
                        ~ {preview.pago.toLocaleString("es-AR", { style: "currency", currency: "EUR" })}
                      </span>
                    )}
                  </div>
                  {preview.reperibilidad && (
                    <p className="mt-1 text-[12px] text-accent-300">
                      Incluye +{(reglas ?? PAY_RULES_FALLBACK).reperibilidad.extraEur} EUR de reperibilidad (
                      {preview.reperibilidad === "FESTIVO" ? "festivo" : "fin de semana"}).
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-ink-400">
                    Estimado: el pago final lo confirma el responsable al aprobar tus horas.
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-ink-400">Completa inicio y fin para ver tus horas.</p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={saving} onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="sm:w-auto sm:px-6" loading={saving} disabled={!canSubmit}>
                Enviar horas
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
