import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { DEPOT_ORIGIN_LABEL } from "../../lib/constants";

// Arma la direccion final que recibe el backend a partir de la parada (texto
// libre, puede incluir el CAP) + el campo CAP aparte (ayuda opcional para que
// la busqueda en el mapa sea mas precisa). Si el CAP ya esta en el texto no lo
// duplica.
export const combineStopAddress = ({ direccion, cap }) => {
  const trimmedDireccion = direccion.trim();
  const trimmedCap = cap.trim();
  if (!trimmedCap || trimmedDireccion.includes(trimmedCap)) return trimmedDireccion;
  return [trimmedDireccion, trimmedCap].filter(Boolean).join(", ");
};

// Lista ordenada de paradas de un servicio (siempre arranca en el deposito fijo,
// que se muestra solo como referencia, no es editable). Cada parada tiene una
// direccion de texto libre y un CAP opcional aparte (ayuda para que el backend
// geocodifique mejor); se combinan en un solo string antes de enviar al backend.
export const StopListEditor = ({ stops, onChange, error, disabled }) => {
  const updateStop = (index, field, value) => {
    const next = [...stops];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addStop = () => onChange([...stops, { direccion: "", cap: "" }]);

  const removeStop = (index) => {
    if (stops.length === 1) return;
    onChange(stops.filter((_, i) => i !== index));
  };

  const moveStop = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-ink-300">Paradas</span>
        <p className="glass-surface-sm rounded-xl px-4 py-3 text-[14px] text-ink-300">
          Salida: {DEPOT_ORIGIN_LABEL}
        </p>
      </div>

      {stops.map((stop, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <TextField
              className="flex-1"
              placeholder="Ej: Via delle Industrie, 2e, Romanengo CR"
              value={stop.direccion}
              disabled={disabled}
              onChange={(e) => updateStop(index, "direccion", e.target.value)}
            />
            <TextField
              className="sm:w-28"
              placeholder="CAP"
              value={stop.cap}
              disabled={disabled}
              onChange={(e) => updateStop(index, "cap", e.target.value)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-3 pt-3">
            <Button
              variant="link"
              disabled={disabled || index === 0}
              onClick={() => moveStop(index, -1)}
            >
              Subir
            </Button>
            <Button
              variant="link"
              disabled={disabled || index === stops.length - 1}
              onClick={() => moveStop(index, 1)}
            >
              Bajar
            </Button>
            <Button
              variant="link"
              disabled={disabled || stops.length === 1}
              onClick={() => removeStop(index)}
            >
              Eliminar
            </Button>
          </div>
        </div>
      ))}

      {error && <span className="block text-[13px] text-danger-500">{error}</span>}

      <Button variant="ghost" className="w-auto" disabled={disabled} onClick={addStop}>
        + Agregar parada
      </Button>
    </div>
  );
};
