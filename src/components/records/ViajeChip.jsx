import { RouteIcon } from "../ui/icons";

// "Viaje 2/3": el servicio va compactado con otros en un solo viaje (la lista del servicio lleva `compactado`).
export const ViajeChip = ({ compactado, className = "" }) => {
  if (!compactado) return null;
  return (
    <span
      title={`Viaje compacto de ${compactado.total} servicios${compactado.principal ? " (servicio principal)" : ""}`}
      className={`inline-flex items-center gap-1 rounded-full bg-accent-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-accent-300 ${className}`}
    >
      <RouteIcon className="h-3 w-3" />
      Viaje {compactado.orden}/{compactado.total}
    </span>
  );
};
