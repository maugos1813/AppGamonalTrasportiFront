import { PermisoEstadoChip } from "./PermisoCard";
import { formatDateOnly } from "../../lib/format";
import { permisoTipoLabel } from "../../lib/permisos";

// Permisos de un chofer que todavia no pasaron (pendientes y aprobados), del mas cercano al mas lejano.
export const ProximosPermisosCard = ({ permisos, today }) => {
  const upcoming = permisos
    .filter((p) => p.estado !== "RECHAZADO" && p.fechaHasta >= today)
    .sort((a, b) => a.fechaDesde.localeCompare(b.fechaDesde))
    .slice(0, 6);

  return (
    <section className="glass-surface rounded-2xl p-4 sm:p-5">
      <h2 className="text-[16px] font-semibold text-ink-50">Proximos permisos</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-300">No hay permisos proximos.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {upcoming.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-line/10 bg-line/[0.03] px-3 py-2"
            >
              <div className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink-50">
                  {formatDateOnly(p.fechaDesde)}
                  {p.fechaHasta !== p.fechaDesde && ` - ${formatDateOnly(p.fechaHasta)}`}
                </span>
                <span className="block truncate text-[12px] text-ink-400">
                  {permisoTipoLabel(p.tipo)}
                  {p.motivo && p.tipo !== "DESCANSO" ? ` - ${p.motivo}` : ""}
                </span>
              </div>
              <PermisoEstadoChip estado={p.estado} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
