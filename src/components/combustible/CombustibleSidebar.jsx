import { DebtSummary, Evolution } from "../mancato/MancatoSidebar";
import { FuelIcon, UsersIcon } from "../ui/icons";
import { COMBUSTIBLE_AREA_BY_VALUE } from "../../lib/combustible";

// Columna derecha de Registro Combustible: gasto del mes por area y por chofer, y la
// evolucion de los ultimos meses.
export const CombustibleSidebar = ({ stats, isPrivileged }) => {
  if (!stats) return null;

  const areaRows = stats.porArea.map((a) => {
    const info = COMBUSTIBLE_AREA_BY_VALUE[a.area];
    return { key: a.area, label: info.label, color: info.color, fg: info.fg, count: a.count, total: a.total };
  });

  const choferRows = stats.porChofer.map((c) => ({
    key: c.driverId ?? "otros",
    label: c.nombre,
    count: c.count,
    total: c.total,
    isOtros: !c.driverId,
  }));

  return (
    <aside className="flex flex-col gap-5">
      <DebtSummary
        icon={FuelIcon}
        title="Gasto por area"
        rows={areaRows}
        total={stats.totalMes}
        unit={["carga", "cargas"]}
        totalLabel={`Total ${stats.mesLabel}`}
        emptyText="Todavia no hay cargas este mes."
      />
      {isPrivileged && (
        <DebtSummary
          icon={UsersIcon}
          title="Gasto por chofer"
          rows={choferRows}
          total={stats.totalMes}
          unit={["carga", "cargas"]}
          totalLabel={`Total ${stats.mesLabel}`}
          emptyText="Todavia no hay cargas este mes."
        />
      )}
      <Evolution
        serie={stats.serie}
        deltaPct={stats.totalMesDeltaPct}
        title="Gasto mensual"
        valueLabel="Gastado"
        note="Total cargado en cada mes. La variacion compara lo que va del mes con el mismo tramo del mes anterior."
      />
    </aside>
  );
};
