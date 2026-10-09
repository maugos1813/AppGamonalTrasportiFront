import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Switch } from "../ui/Switch";
import { parseApiError } from "../../lib/api";
import { CATEGORIA_VEHICULO_LABELS, LITROS_MINIMOS_COMBUSTIBLE } from "../../lib/vehiculos";
import { updateDeclaracionesRequest } from "../../lib/records.api";

// Que le falta a un servicio terminado: se muestra como avisos rojos en la lista y el detalle.
export const FALTANTE_LABELS = { ida: "Peaje de ida", vuelta: "Peaje de vuelta", combustible: "Carburante" };

export const hasFaltantes = (record) => (record.faltantes?.pendientes ?? 0) > 0;

export const FaltantesChips = ({ faltantes, className = "" }) => {
  if (!faltantes?.pendientes) return null;
  const items = Object.keys(FALTANTE_LABELS).filter((key) => faltantes[key]);
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-danger-500">Falta</span>
      {items.map((key) => (
        <span key={key} className="rounded-full bg-danger-500/15 px-2 py-0.5 text-[10.5px] font-medium text-danger-500">
          {FALTANTE_LABELS[key]}
        </span>
      ))}
    </span>
  );
};

const fmtL = (n) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 });

// Los tres switches del chofer. "values" = lo declarado; "onToggle(campo, valor)" lo cambia. Si ya hay un peaje
// o combustible asignado al servicio, ese punto esta resuelto y no pide switch.
export const FaltantesSwitches = ({ record, values, onToggle, disabled }) => {
  const location = useLocation();
  const mancatos = record.mancatos ?? [];
  const hasIda = mancatos.some((m) => m.tramo === "IDA");
  const hasVuelta = mancatos.some((m) => m.tramo === "VUELTA");
  const fuelCount = record.combustible?.comprobantes?.count ?? 0;
  const litros = record.faltantes?.litrosEstimados;

  const row = ({ done, doneText, id, label, field, hint, uploadTo, uploadLabel }) =>
    done ? (
      <div className="flex items-center gap-2 text-[13px] text-success-500">
        <span aria-hidden="true">✓</span>
        {doneText}
      </div>
    ) : (
      <div className="flex flex-col gap-1.5">
        <Switch id={id} label={label} description={hint} checked={Boolean(values[field])} disabled={disabled} onChange={(v) => onToggle(field, v)} />
        {!values[field] && (
          <Link
            to={uploadTo}
            state={{ backgroundLocation: location }}
            className="w-fit text-[12.5px] font-medium text-accent-400 hover:text-accent-300"
          >
            {uploadLabel} &rarr;
          </Link>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {row({
        done: hasIda,
        doneText: "Peaje de ida: aviso subido",
        id: "sin-peaje-ida",
        label: "Servicio de ida: no usé peaje",
        field: "sinPeajeIda",
        hint: "Actívalo si en la ida no tuviste mancato pagamento.",
        uploadTo: "/finanzas/mancato/new",
        uploadLabel: "Subir mancato pagamento de ida",
      })}
      {row({
        done: hasVuelta,
        doneText: "Peaje de vuelta: aviso subido",
        id: "sin-peaje-vuelta",
        label: "Volviendo después del servicio: no usé peaje al retornar",
        field: "sinPeajeVuelta",
        hint: "Actívalo si en la vuelta no tuviste mancato pagamento.",
        uploadTo: "/finanzas/mancato/new",
        uploadLabel: "Subir mancato pagamento de vuelta",
      })}
      {row({
        done: fuelCount > 0,
        doneText: `Carburante: ${fuelCount} comprobante${fuelCount === 1 ? "" : "s"} cargado${fuelCount === 1 ? "" : "s"}`,
        id: "sin-combustible",
        label: "Carburante: no fue necesario llenar para este servicio",
        field: "sinCombustible",
        hint: litros
          ? `Se estiman ${fmtL(litros.min)}–${fmtL(litros.max)} L para ${fmtL(litros.km)} km (${CATEGORIA_VEHICULO_LABELS[record.vehicle?.categoria]}). ${
              record.faltantes.exigeCombustible
                ? "Con este consumo se pide comprobante."
                : `No se exige comprobante por debajo de ${LITROS_MINIMOS_COMBUSTIBLE} L.`
            }`
          : "Este vehículo no tiene categoría de consumo o el servicio no tiene km: no se puede estimar.",
        uploadTo: "/finanzas/combustible/new",
        uploadLabel: "Cargar comprobante de combustible",
      })}
    </div>
  );
};

// Tarjeta del detalle de un servicio terminado: cada cambio se guarda al instante.
export const FaltantesCard = ({ record, onReload }) => {
  const f = record.faltantes;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [local, setLocal] = useState({});
  const declaredKey = JSON.stringify(f?.declarado ?? {});
  // Cuando llega el servicio recargado, lo declarado ya es lo guardado.
  useEffect(() => {
    setLocal({});
  }, [declaredKey]);
  if (!f?.aplica) return null;

  const values = { ...f.declarado, ...local };
  const handleToggle = async (field, value) => {
    setError("");
    setSaving(true);
    setLocal((prev) => ({ ...prev, [field]: value }));
    try {
      await updateDeclaracionesRequest(record.id, { [field]: value });
      onReload?.();
    } catch (err) {
      setLocal((prev) => ({ ...prev, [field]: !value }));
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`mt-6 rounded-2xl border p-4 ${f.pendientes > 0 ? "border-danger-500/40 bg-danger-500/[0.07]" : "border-line/10 bg-line/[0.03]"}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-ink-50">Peajes y carburante</h3>
        {f.pendientes > 0 ? (
          <FaltantesChips faltantes={f} />
        ) : (
          <span className="text-[12px] font-medium text-success-500">Todo al día</span>
        )}
      </div>
      <Alert>{error}</Alert>
      <FaltantesSwitches record={record} values={values} onToggle={handleToggle} disabled={saving} />
    </div>
  );
};
