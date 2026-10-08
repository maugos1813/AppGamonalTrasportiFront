import clsx from "clsx";
import { DIA_ESTADOS, LEGEND_ESTADOS, diaCellClass } from "../../lib/permisos";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

const SummaryTile = ({ label, value, tone }) => (
  <div className="glass-surface-sm rounded-2xl px-3 py-2.5 text-center">
    <span className={clsx("block text-[22px] font-semibold leading-none", tone)}>{value}</span>
    <span className="mt-1 block text-[11px] text-ink-300">{label}</span>
  </div>
);

// Cuadricula del mes (lunes a domingo). Verde = trabajado, rojo = no trabajado, naranja =
// justificado y aprobado, naranja punteado = permiso en revision. onSelect recibe el dia tocado.
export const CalendarioMes = ({ data, selected, onSelect }) => {
  const [year, month] = data.month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const { summary } = data;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        <SummaryTile label="Trabajados" value={summary.trabajados} tone="text-success-500" />
        <SummaryTile label="No trabajados" value={summary.noTrabajados} tone="text-danger-500" />
        <SummaryTile label="Justificados" value={summary.justificados} tone="text-warning-500" />
        <SummaryTile label="En revision" value={summary.pendientes} tone="text-warning-500" />
        <SummaryTile label="Dias libres" value={summary.descansos} tone="text-ink-200" />
      </div>

      <div className="glass-surface rounded-2xl p-3 sm:p-4">
        <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase text-ink-400 sm:gap-2">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: offset }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {data.days.map((dia) => (
            <button
              key={dia.fecha}
              type="button"
              onClick={() => onSelect?.(dia)}
              aria-label={`${dia.fecha}: ${DIA_ESTADOS[dia.estado].label || "sin datos"}`}
              className={diaCellClass(dia, selected === dia.fecha)}
            >
              {Number(dia.fecha.slice(8))}
              {dia.servicios > 0 && dia.estado === "TRABAJADO" && dia.servicios > 1 && (
                <span className="absolute bottom-1 text-[9px] font-medium opacity-80">{dia.servicios}</span>
              )}
              {dia.completo && (
                <span className="absolute bottom-1 h-0.5 w-5 rounded bg-danger-500" aria-hidden="true" />
              )}
              {dia.estado === "PROGRAMADO" && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent-400" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line/10 pt-3 text-[12px] text-ink-300">
          {LEGEND_ESTADOS.map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className={clsx("h-2.5 w-2.5 rounded-full", DIA_ESTADOS[key].dot)} />
              {DIA_ESTADOS[key].label}
            </span>
          ))}
          {data.tope && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-danger-500" />
              Dia completo (sin cupo de permisos)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
