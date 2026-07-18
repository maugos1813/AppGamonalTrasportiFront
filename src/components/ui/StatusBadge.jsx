import clsx from "clsx";
import { RECORD_STATUS_LABELS, RECORD_STATUS_TONE } from "../../lib/constants";

// Badge de fondo solido (paleta de estados del style pack Express Dispatch):
// no necesita variante clara/oscura, un chip de color pleno con texto blanco
// se lee igual de bien sobre cualquier fondo.
const TONE_CLASSES = {
  pendiente: "bg-status-pendiente",
  "in-corso": "bg-status-in-corso",
  consegnato: "bg-status-consegnato",
  ritirato: "bg-status-ritirato",
  rischedulato: "bg-status-rischedulato",
  annullato: "bg-status-annullato",
};

export const StatusBadge = ({ status, className }) => (
  <span
    className={clsx(
      "inline-flex items-center rounded px-2.5 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap text-white",
      TONE_CLASSES[RECORD_STATUS_TONE[status]] || TONE_CLASSES.pendiente,
      className
    )}
  >
    {RECORD_STATUS_LABELS[status] || status}
  </span>
);
