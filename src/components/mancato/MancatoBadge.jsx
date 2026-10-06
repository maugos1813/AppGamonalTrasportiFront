import clsx from "clsx";
import { MANCATO_ESTADO_BY_VALUE, plazoLabel } from "../../lib/mancato";

// Pastilla de estado (Vencido / Pendiente / Pagado). Con `plazo` muestra ademas cuanto
// falta o cuanto lleva vencido en vez del nombre del estado.
export const MancatoBadge = ({ mancato, plazo = false, className }) => {
  const estado = MANCATO_ESTADO_BY_VALUE[mancato.estado];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium",
        estado.pill,
        className
      )}
    >
      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", estado.dot)} />
      {plazo ? plazoLabel(mancato) : estado.label}
    </span>
  );
};
