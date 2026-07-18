import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { Spinner } from "../../components/ui/Spinner";
import { VehicleStatusBadge } from "../../components/ui/VehicleStatusBadge";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, GRUPO_OPTIONS } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

const VehicleCard = ({ vehicle }) => (
  <Link to={`/vehiculos/${vehicle.id}`} className="block">
    <GlassCard className="transition-colors hover:bg-line/[0.09]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-medium text-ink-400">{vehicle.targa}</span>
          <h2 className="mt-0.5 text-[17px] font-medium text-ink-50">{vehicle.modelo}</h2>
        </div>
        <VehicleStatusBadge status={vehicle.estado} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <span className="block text-ink-400">Area</span>
          <span className="text-ink-50">{areaLabel(vehicle.area)}</span>
        </div>
        <div>
          <span className="block text-ink-400">Poliza</span>
          <span className="text-ink-50">{formatDate(vehicle.poliza)}</span>
        </div>
        <div>
          <span className="block text-ink-400">Revision tecnica</span>
          <span className="text-ink-50">{formatDate(vehicle.rTecnica)}</span>
        </div>
      </div>
    </GlassCard>
  </Link>
);

const GroupSection = ({ title, members }) => (
  <div className="flex flex-col gap-4">
    <h2 className="text-[15px] font-medium text-ink-100">
      {title}{" "}
      <span className="text-ink-400">
        ({members.length} {members.length === 1 ? "vehiculo" : "vehiculos"})
      </span>
    </h2>
    {members.length === 0 ? (
      <GlassCard className="text-center text-[14px] text-ink-300">
        Todavia no hay vehiculos asignados a este grupo.
      </GlassCard>
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {members.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    )}
  </div>
);

export const VehiclesPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPrivileged) return;
    listVehiclesRequest()
      .then(setVehicles)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const unassignedVehicles = vehicles?.filter((v) => !v.grupo) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Vehiculos</h1>
          <p className="mt-1 text-[14px] text-ink-300">Flota de Gamonal Trasporti.</p>
        </div>
        <Link to="/vehiculos/new">
          <Button className="w-auto px-5">Nuevo vehiculo</Button>
        </Link>
      </div>

      <Alert>{error}</Alert>

      {vehicles === null && !error && (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 border-line/20 border-t-line" />
        </div>
      )}

      {vehicles?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          Todavia no hay vehiculos cargados.
        </GlassCard>
      )}

      {vehicles !== null && vehicles.length > 0 && (
        <>
          {GRUPO_OPTIONS.map((grupo) => (
            <GroupSection
              key={grupo.value}
              title={grupo.label.toUpperCase()}
              members={vehicles.filter((v) => v.grupo === grupo.value)}
            />
          ))}

          {unassignedVehicles.length > 0 && (
            <GroupSection title="SIN GRUPO ASIGNAR" members={unassignedVehicles} />
          )}
        </>
      )}
    </div>
  );
};
