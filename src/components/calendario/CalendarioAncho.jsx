import clsx from "clsx";
import { DIA_ESTADOS, LEGEND_ESTADOS, permisoTipoLabel } from "../../lib/permisos";

const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const dotClass = (estado) =>
  clsx(
    "h-2 w-2 shrink-0 rounded-full",
    DIA_ESTADOS[estado]?.dot,
    estado === "PERMISO_PENDIENTE" && "h-2 w-2"
  );

const chipClass = (permiso) =>
  clsx(
    "max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:text-[11px]",
    permiso.estado === "PENDIENTE"
      ? "border border-dashed border-warning-500 text-warning-500"
      : permiso.tipo === "DESCANSO"
        ? "bg-[#8b5cf6]/20 text-[#a78bfa]"
        : "bg-warning-500/20 text-warning-500"
  );

// Calendario del mes con celdas anchas (vista de la oficina): numero del dia, un punto con el estado
// (verde trabajado, rojo no trabajado, naranja justificado), el tipo de permiso en una etiqueta y los
// servicios del dia. onSelect recibe el dia tocado.
export const CalendarioAncho = ({ data, selected, onSelect }) => {
  const [year, month] = data.month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400 sm:gap-2">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {data.days.map((dia) => {
          const muted = dia.estado === "FUTURO" || dia.estado === "SIN_DATOS";
          return (
            <button
              key={dia.fecha}
              type="button"
              onClick={() => onSelect?.(dia)}
              aria-label={`${dia.fecha}: ${DIA_ESTADOS[dia.estado].label || "sin datos"}`}
              className={clsx(
                "relative flex min-h-[62px] flex-col justify-between rounded-xl border p-1.5 text-left transition-colors sm:min-h-[82px] sm:p-2",
                "border-line/10 bg-line/[0.03] hover:bg-line/10",
                dia.estado === "HOY" && "border-accent-400 bg-accent-500/10",
                selected === dia.fecha && "ring-2 ring-ink-50/70"
              )}
            >
              <span className={clsx("text-[13px] font-semibold sm:text-[14px]", muted ? "text-ink-400" : "text-ink-50")}>
                {Number(dia.fecha.slice(8))}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                {dia.permiso && (
                  <>
                    <span className={clsx(chipClass(dia.permiso), "hidden sm:block")}>
                      {dia.permiso.tipo === "DESCANSO" ? "Dia libre" : permisoTipoLabel(dia.permiso.tipo)}
                    </span>
                    <span className={clsx(chipClass(dia.permiso), "block h-1.5 w-full p-0 sm:hidden")} aria-hidden="true" />
                  </>
                )}
                <span className="flex items-center gap-1.5">
                  {!muted && dia.estado !== "HOY" && dia.estado !== "PROGRAMADO" && <span className={dotClass(dia.estado)} />}
                  {dia.estado === "PROGRAMADO" && <span className="h-2 w-2 rounded-full bg-accent-400" />}
                  {dia.servicios > 0 && <span className="text-[10px] text-ink-300">{dia.servicios} serv.</span>}
                  {dia.completo && <span className="ml-auto h-0.5 w-4 rounded bg-danger-500" title="Dia completo" />}
                </span>
              </span>
            </button>
          );
        })}
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
            Dia completo
          </span>
        )}
      </div>
    </div>
  );
};
