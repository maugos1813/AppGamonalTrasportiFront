import clsx from "clsx";
import { RECORD_STATUS_LABELS, RECORD_STATUS_TONE } from "../../lib/constants";

const STATUS_PILL = {
  pendiente: "bg-status-pendiente/20 text-ink-200",
  "in-corso": "bg-status-in-corso/20 text-accent-300",
  consegnato: "bg-status-consegnato/20 text-success-500",
  ritirato: "bg-status-ritirato/20 text-status-ritirato",
  rischedulato: "bg-status-rischedulato/20 text-status-rischedulato",
  annullato: "bg-status-annullato/20 text-danger-500",
};

export const StatusPill = ({ estado, className }) => (
  <span
    className={clsx(
      "inline-block shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium",
      STATUS_PILL[RECORD_STATUS_TONE[estado]],
      className
    )}
  >
    {RECORD_STATUS_LABELS[estado] || estado}
  </span>
);
