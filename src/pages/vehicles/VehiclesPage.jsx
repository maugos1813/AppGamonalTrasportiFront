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

const TruckIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M2 6.5h10.5v9H2v-9zm10.5 3H17l3.5 3v3h-8v-6zM6 18.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5zm11 0a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Card baja de 3 columnas: foto en el primer tercio (izquierda), descripcion
// clave del vehiculo en los otros dos tercios (derecha) - mas compacta en
// altura que el banner de foto arriba + texto abajo que tenia antes.
const VehicleCard = ({ vehicle }) => (
  <Link to={`/vehiculos/${vehicle.id}`} className="block">
    <GlassCard className="!p-0 overflow-hidden transition-colors hover:bg-line/[0.09]">
      <div className="flex h-32">
        <div className="w-1/3 shrink-0">
          {vehicle.imagenUrl ? (
            <img
              src={vehicle.imagenUrl}
              alt={vehicle.targa}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-accent-500/10 text-accent-300/40">
              <TruckIcon className="h-9 w-9" />
            </div>
          )}
        </div>

        <div className="flex w-2/3 min-w-0 flex-col justify-center gap-1.5 px-3">
          <h2 className="truncate text-[14px] font-medium text-ink-50">{vehicle.modelo}</h2>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-ink-400">{vehicle.targa}</span>
            <VehicleStatusBadge status={vehicle.estado} className="shrink-0 !px-1.5 !py-0.5 !text-[9px]" />
          </div>
          <span className="truncate text-[11px] text-ink-400">
            {areaLabel(vehicle.area)} &middot; Poliza: {formatDate(vehicle.poliza)}
          </span>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
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
