import clsx from "clsx";
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUS_TONE } from "../../lib/constants";

const TONE_CLASSES = {
  consegnato: "bg-status-consegnato",
  rischedulato: "bg-status-rischedulato",
  annullato: "bg-status-annullato",
};

export const VehicleStatusBadge = ({ status, className }) => (
  <span
    className={clsx(
      "inline-flex items-center rounded px-2.5 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap text-white",
      TONE_CLASSES[VEHICLE_STATUS_TONE[status]] || TONE_CLASSES.rischedulato,
      className
    )}
  >
    {VEHICLE_STATUS_LABELS[status] || status}
  </span>
);
