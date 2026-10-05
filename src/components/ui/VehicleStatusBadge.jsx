import clsx from "clsx";
import { VEHICLE_STATUS_LABELS } from "../../lib/constants";

// Verde = disponible (estado correcto), naranja = atencion (mantenimiento), rojo =
// problema real (fuera de servicio) - el color solo significa estado.
const STATUS_STYLES = {
  DISPONIBLE: { dot: "bg-success-500", pill: "bg-success-500/15 text-success-500" },
  EN_MANTENIMIENTO: { dot: "bg-warning-500 shadow-[0_0_6px_var(--warning-500)]", pill: "bg-warning-500/20 text-warning-500 ring-1 ring-warning-500/40" },
  FUERA_DE_SERVICIO: { dot: "bg-danger-500 shadow-[0_0_6px_var(--danger-500)]", pill: "bg-danger-500/20 text-danger-500 ring-1 ring-danger-500/40" },
};

export const VehicleStatusBadge = ({ status, className }) => {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.EN_MANTENIMIENTO;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
        style.pill,
        className
      )}
    >
      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
      {VEHICLE_STATUS_LABELS[status] || status}
    </span>
  );
};
