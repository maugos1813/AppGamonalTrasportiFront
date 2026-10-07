import clsx from "clsx";
import { HORAS_ESTADOS, horasEstadoKey } from "../../lib/horas";

export const HorasEstadoChip = ({ estado, className }) => {
  const config = HORAS_ESTADOS[horasEstadoKey(estado)];
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        config.pill,
        className
      )}
    >
      {config.label}
    </span>
  );
};
