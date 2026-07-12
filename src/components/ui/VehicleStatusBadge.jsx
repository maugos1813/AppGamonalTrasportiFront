import clsx from "clsx";
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUS_TONE } from "../../lib/constants";

const TONE_CLASSES = {
  amber: "bg-amber-400/15 text-amber-300 border-amber-400/25",
  green: "bg-success-500/15 text-[#4ddb6e] border-success-500/25",
  red: "bg-danger-500/15 text-[#ff6961] border-danger-500/25",
  slate: "bg-white/10 text-ink-200 border-white/15",
};

export const VehicleStatusBadge = ({ status, className }) => (
  <span
    className={clsx(
      "inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium whitespace-nowrap",
      TONE_CLASSES[VEHICLE_STATUS_TONE[status]] || TONE_CLASSES.slate,
      className
    )}
  >
    {VEHICLE_STATUS_LABELS[status] || status}
  </span>
);
