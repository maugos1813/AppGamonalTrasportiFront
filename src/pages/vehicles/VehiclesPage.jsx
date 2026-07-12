import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { Spinner } from "../../components/ui/Spinner";
import { VehicleStatusBadge } from "../../components/ui/VehicleStatusBadge";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

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

  return (
    <div className="flex flex-col gap-6">
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
          <Spinner className="h-6 w-6 border-white/20 border-t-white" />
        </div>
      )}

      {vehicles?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          Todavia no hay vehiculos cargados.
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {vehicles?.map((vehicle) => (
          <GlassCard key={vehicle.id}>
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
        ))}
      </div>
    </div>
  );
};
