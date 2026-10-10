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
import { extraEsGrande, formatKmValue, repartirKm } from "../../lib/compactado";
import { formatHours, previewShift } from "../../lib/horas";
import { submitHorasRequest } from "../../lib/horas.api";
import { updateDeclaracionesRequest } from "../../lib/records.api";
import { ViajeStops } from "../chofer/ViajeStops";
import { FaltantesSwitches } from "../records/FaltantesPanel";

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
  // Viaje compacto: los km reales son los de TODO el viaje y el sistema los reparte entre sus servicios.
  const viajeKm = record.compactado?.principal ? record.compactado.km : null;
  const [km, setKm] = useState(viajeKm ? (viajeKm.real ?? "") : (record.kilometrosReales ?? ""));
  // Con km de mas, en que servicios fueron (si marca varios se reparten) y por que.
  const [extraIds, setExtraIds] = useState(viajeKm?.reparto?.origen === "CHOFER" ? (viajeKm.reparto.servicioIds ?? []) : []);
  const [extraNota, setExtraNota] = useState(viajeKm?.reparto?.origen === "CHOFER" ? (viajeKm.reparto.nota ?? "") : "");
  const [comentarios, setComentarios] = useState(record.comentarios ?? "");
  // Termino sin pasar por el lugar de espera (por ejemplo fue directo a casa): su fin es la hora de llegada.
  const [finFueraDeBase, setFinFueraDeBase] = useState(Boolean(jornada.finFueraDeBase));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Lo que el chofer declara sobre peajes y carburante de este servicio.
  const [declared, setDeclared] = useState(() => ({
    sinPeajeIda: Boolean(record.faltantes?.declarado?.sinPeajeIda),
    sinPeajeVuelta: Boolean(record.faltantes?.declarado?.sinPeajeVuelta),
    sinCombustible: Boolean(record.faltantes?.declarado?.sinCombustible),
  }));
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
  // Km de mas del viaje: reales anotados menos planificados de todos sus servicios.
  const kmNum = km !== "" ? Number(km) : null;
  const kmExtra = viajeKm && kmNum != null ? Math.round((kmNum - viajeKm.planificado) * 10) / 10 : null;
  const kmExtraGrande = kmExtra != null && kmExtra > 0 && extraEsGrande(kmExtra, viajeKm.planificado);
  const kmReparto =
    viajeKm && kmNum != null
      ? repartirKm({
          total: kmNum,
          servicios: record.compactado.servicios.map((s) => ({ id: s.id, plan: s.kmPlan ?? 0 })),
          extraIds: kmExtra > 0 ? extraIds : [],
        })
      : null;
  const toggleExtra = (id) => setExtraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
        ...(viajeKm && kmExtra > 0 && (extraIds.length > 0 || extraNota.trim())
          ? { kmExtra: { servicioIds: extraIds, ...(extraNota.trim() ? { nota: extraNota.trim() } : {}) } }
          : {}),
        ...(comentarios.trim() ? { comentarios: comentarios.trim() } : {}),
        entregado: true,
        finFueraDeBase,
      });
      // Declaraciones de peajes y carburante, si el chofer las cambio.
      const changed = Object.fromEntries(
        Object.entries(declared).filter(([field, value]) => value !== Boolean(record.faltantes?.declarado?.[field]))
      );
      if (Object.keys(changed).length > 0) await updateDeclaracionesRequest(record.id, changed).catch(() => {});
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
              Tus horas quedaron en revision. Si todo está dentro de lo planificado (horas y km), se aprueban solas en unos
              minutos; si no, las revisa el responsable. Cuando se aprueban, cuentan para tu pago.
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
              <h2 className="text-[19px] font-semibold text-ink-50">
                {record.compactado?.principal ? "Terminar viaje" : "Terminar servicio"}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-300">
                {record.codigo} &middot; {record.destinazione}
              </p>
            </div>

            {record.compactado?.principal && (
              <div className="rounded-xl bg-accent-500/10 px-4 py-3">
                <p className="mb-2 text-[13px] text-ink-200">
                  <b className="text-accent-300">Viaje compacto de {record.compactado.total} servicios.</b> Carga una sola
                  jornada: desde que sales a la primera parada hasta que terminas la última. Al enviar, todos los
                  servicios del viaje quedan entregados.
                </p>
                <ViajeStops compactado={record.compactado} />
              </div>
            )}

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

            <div>
              <TextField
                id="horas-km"
                label={viajeKm ? "Km reales de todo el viaje (opcional)" : "Km reales (opcional)"}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
              {viajeKm && (
                <div className="mt-2 text-[12px] text-ink-300">
                  {viajeKm.circuito ? "Circuito planificado del viaje" : "Planificado del viaje"}:{" "}
                  <b className="text-ink-100">{formatKmValue(viajeKm.planificado)}</b>
                  {viajeKm.circuito
                    ? " (lugar de espera, retiro, todas las paradas en orden y vuelta al lugar de espera)"
                    : record.compactado.servicios.length > 1 &&
                      ` (${record.compactado.servicios.map((s) => formatKmValue(s.kmPlan).replace(" km", "")).join(" + ")})`}
                  . Anota los km de todo el viaje: el sistema los reparte entre los servicios.
                </div>
              )}

              {!viajeKm && record.circuito?.km > 0 && (
                <div className="mt-2 text-[12px] text-ink-300">
                  Circuito planificado: <b className="text-ink-100">{formatKmValue(record.circuito.km)}</b> (lugar de espera,
                  retiro, entrega y vuelta al lugar de espera).
                </div>
              )}

              {viajeKm && kmNum != null && kmExtra > 0 && !kmExtraGrande && (
                <p className="mt-2 text-[12px] text-ink-400">
                  Hiciste {formatKmValue(kmExtra)} más de lo planificado: se reparten solos entre los servicios.
                </p>
              )}

              {viajeKm && kmExtraGrande && (
                <div className="mt-3 rounded-xl bg-warning-500/10 px-4 py-3">
                  <p className="text-[13px] font-medium text-ink-50">
                    Hiciste {formatKmValue(kmExtra)} más de lo planificado. ¿En qué servicio fue?
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-300">
                    Marca el que tuvo los km de más (si marcas varios, se reparten entre ellos). Si no sabes, déjalo sin
                    marcar y se reparten proporcional.
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {record.compactado.servicios.map((s) => (
                      <label key={s.id} className="flex items-center gap-2.5 text-[13px] text-ink-100">
                        <input
                          type="checkbox"
                          checked={extraIds.includes(s.id)}
                          onChange={() => toggleExtra(s.id)}
                          className="h-4 w-4 shrink-0 rounded border-line/20 bg-transparent accent-accent-500"
                        />
                        <span className="min-w-0 truncate">
                          {s.codigo} · {s.destinazione}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Textarea
                      id="horas-km-extra-nota"
                      label="¿Por qué? (opcional)"
                      rows={2}
                      value={extraNota}
                      onChange={(e) => setExtraNota(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {kmReparto && record.compactado.servicios.length > 1 && (
                <p className="mt-2 text-[12px] text-ink-300">
                  Quedaría:{" "}
                  {record.compactado.servicios
                    .map((s) => `${s.codigo.split("-").pop()} ${formatKmValue(kmReparto.km.find((r) => r.id === s.id)?.km)}`)
                    .join(" · ")}
                </p>
              )}
            </div>
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

            <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
              <h3 className="mb-3 text-[14px] font-semibold text-ink-50">Peajes y carburante</h3>
              <FaltantesSwitches
                record={{ ...record, faltantes: { ...record.faltantes, litrosEstimados: record.faltantes?.litrosEstimados } }}
                values={declared}
                onToggle={(field, value) => setDeclared((prev) => ({ ...prev, [field]: value }))}
                onAll={(fields) => setDeclared((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, true])) }))}
                disabled={saving}
              />
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
