import clsx from "clsx";
import { CheckCircleIcon } from "../ui/icons";
import { formatDateTime } from "../../lib/format";

const DONE = ["CONSEGNATO"];

// Las paradas de un viaje compacto en orden: numero, servicio, destino y hora de llegada (ETA); con un check las
// que ya se entregaron.
export const ViajeStops = ({ compactado, className }) => {
  if (!compactado?.servicios?.length) return null;
  return (
    <ol className={clsx("flex flex-col gap-1.5", className)}>
      {compactado.servicios.map((s, index) => {
        const done = DONE.includes(s.estado);
        return (
          <li key={s.id} className="flex items-center gap-2.5 rounded-xl bg-line/[0.05] px-3 py-2">
            <span
              className={clsx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                done ? "bg-success-500/20 text-success-500" : "bg-accent-500/20 text-accent-300"
              )}
            >
              {done ? <CheckCircleIcon className="h-4 w-4" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-ink-50">
                {s.codigo} <span className="text-ink-400">—</span> {s.destinazione}
              </span>
              <span className="block text-[11px] text-ink-400">
                ETA {formatDateTime(s.eta)}
                {s.recibidoDe && <span className="text-accent-400"> · paquete recibido de {s.recibidoDe}</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};
