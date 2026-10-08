import clsx from "clsx";
import { formatDateOnly, formatRomeDateTime } from "../../lib/format";
import { PERMISO_ESTADOS, anticipacionText, permisoTipoLabel } from "../../lib/permisos";

export const PermisoEstadoChip = ({ estado, className }) => (
  <span
    className={clsx(
      "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
      PERMISO_ESTADOS[estado].pill,
      className
    )}
  >
    {PERMISO_ESTADOS[estado].label}
  </span>
);

// Una solicitud con su fecha y hora automatica de registro. "actions": botones (aprobar, cancelar...).
export const PermisoCard = ({ permiso, showDriver = false, actions }) => {
  const sameDay = permiso.fechaDesde === permiso.fechaHasta;
  return (
    <div className="glass-surface rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showDriver && permiso.driver && (
            <span className="block truncate text-[14px] font-semibold text-ink-50">
              {permiso.driver.nombre} {permiso.driver.apellido}
            </span>
          )}
          <span className="block text-[14px] text-ink-50">
            <b className="font-semibold">{permisoTipoLabel(permiso.tipo)}</b> &middot;{" "}
            {sameDay
              ? formatDateOnly(permiso.fechaDesde)
              : `${formatDateOnly(permiso.fechaDesde)} - ${formatDateOnly(permiso.fechaHasta)} (${permiso.dias} dias)`}
          </span>
        </div>
        <PermisoEstadoChip estado={permiso.estado} />
      </div>

      {permiso.motivo && <p className="mt-2 text-[13px] text-ink-200">{permiso.motivo}</p>}

      <p className="mt-2 text-[12px] text-ink-400">
        Solicitado el {formatRomeDateTime(permiso.solicitadoAt)} &middot; {anticipacionText(permiso)}
      </p>

      {permiso.revisadoAt && (
        <p className="mt-1 text-[12px] text-ink-400">
          {permiso.estado === "APROBADO" ? "Aprobado" : "Resuelto"} por {permiso.revisadoPor ?? "la oficina"} el{" "}
          {formatRomeDateTime(permiso.revisadoAt)}
        </p>
      )}
      {permiso.respuesta && (
        <p className="mt-2 rounded-lg bg-line/5 px-3 py-2 text-[12px] text-ink-200">
          <b className="text-ink-50">Respuesta:</b> {permiso.respuesta}
        </p>
      )}

      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
};
