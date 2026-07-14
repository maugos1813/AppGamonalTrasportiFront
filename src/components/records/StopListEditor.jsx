import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { DEPOT_ORIGIN_LABEL } from "../../lib/constants";

// Lista ordenada de paradas de un servicio (siempre arranca en el deposito fijo,
// que se muestra solo como referencia, no es editable). Cada parada es una direccion
// de texto libre (con CAP incluido, ej: "Via delle Industrie, 2e, 26014 Romanengo CR"),
// que el backend geocodifica y encadena en una ruta.
export const StopListEditor = ({ stops, onChange, error, disabled }) => {
  const updateStop = (index, value) => {
    const next = [...stops];
    next[index] = value;
    onChange(next);
  };

  const addStop = () => onChange([...stops, ""]);

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
          <TextField
            className="flex-1"
            placeholder="Ej: Via delle Industrie, 2e, 26014 Romanengo CR"
            value={stop}
            disabled={disabled}
            onChange={(e) => updateStop(index, e.target.value)}
          />
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
