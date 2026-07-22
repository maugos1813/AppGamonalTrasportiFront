import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { Spinner } from "../../components/ui/Spinner";
import { VehicleStatusBadge } from "../../components/ui/VehicleStatusBadge";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import {
  AREA_OPTIONS,
  GRUPO_OPTIONS,
  TAGLIANDO_STATUS_LABELS,
  getTagliandoStatus,
} from "../../lib/constants";
import { computeFleetKmUsage, computeVehicleDocumentAlerts } from "../../lib/dashboardStats";
import { formatDate } from "../../lib/format";
import { listRecordsByMonthRequest } from "../../lib/records.api";
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

// Foto circular tipo avatar (o el icono de camion si no hay foto cargada) - mismo
// patron que el Avatar de choferes, en vez de la foto rectangular grande de antes.
const VehicleAvatar = ({ vehicle, className }) =>
  vehicle.imagenUrl ? (
    <img
      src={vehicle.imagenUrl}
      alt={vehicle.targa}
      className={clsx("shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-300/60",
        className
      )}
    >
      <TruckIcon className="h-1/2 w-1/2" />
    </div>
  );

// Card compacta, mismo patron que DriverCard: avatar circular + nombre arriba,
// targa/area/estado en una fila chica abajo - en vez de la foto grande que ocupaba
// un tercio de la card y dejaba poco lugar para el texto.
const VehicleCard = ({ vehicle }) => (
  <Link to={`/vehiculos/${vehicle.id}`} className="block">
    <GlassCard className="!p-4 transition-colors hover:bg-line/[0.09]">
      <div className="flex items-center gap-3">
        <VehicleAvatar vehicle={vehicle} className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-medium text-ink-50">{vehicle.modelo}</h2>
          <p className="truncate text-[12px] text-ink-300">{vehicle.targa}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-ink-400">{areaLabel(vehicle.area)}</span>
        <VehicleStatusBadge status={vehicle.estado} className="shrink-0 !px-2 !py-0.5 !text-[11px]" />
      </div>
    </GlassCard>
  </Link>
);

// @container (no breakpoints de viewport): la grilla ahora vive en una columna de
// 2/3 de pantalla, no en el ancho completo - con sm:/lg:/xl: (que miran el viewport)
// quedaba apretada, porque esos breakpoints no saben que el contenedor es mas
// angosto. Las variantes @sm/@md/@xl miran el ancho real disponible.
const GroupSection = ({ title, members }) => (
  <div className="@container flex flex-col gap-4">
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
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @md:grid-cols-3 @xl:grid-cols-4">
        {members.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    )}
  </div>
);

// Poliza de seguro y revision tecnica por vencer o ya vencidas - misma logica que
// alimenta la campanita de notificaciones (computeVehicleDocumentAlerts), asi que
// no hace falta pedir nada nuevo: ya se cuenta con la lista completa de vehiculos.
const DocumentAlertsPanel = ({ vehicles }) => {
  const alerts = vehicles ? computeVehicleDocumentAlerts(vehicles) : undefined;

  return (
    <GlassCard className="flex flex-col !p-4 lg:max-h-[45vh]">
      <h2 className="px-1 text-[15px] font-semibold text-ink-50">Documentos</h2>
      <p className="mb-3 px-1 text-[12px] text-ink-400">Poliza y revision tecnica por vencer o vencidas.</p>

      <div className="flex flex-col gap-2 overflow-y-auto">
        {alerts === undefined && (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
          </div>
        )}
        {alerts?.length === 0 && (
          <p className="py-3 text-center text-[13px] text-ink-300">Ningun documento por vencer.</p>
        )}
        {alerts?.map((alert) => {
          const vencido = new Date(alert.date) < new Date();
          return (
            <Link
              key={alert.id}
              to={alert.link}
              className="flex items-center gap-2.5 rounded-xl glass-surface-sm px-3 py-2.5 text-[13px] transition-colors hover:bg-line/[0.08]"
            >
              <span
                className={clsx(
                  "h-2.5 w-2.5 shrink-0 rounded-full",
                  vencido ? "bg-danger-500" : "bg-status-rischedulato"
                )}
              />
              <p className="min-w-0 flex-1 truncate text-ink-50">{alert.message}</p>
            </Link>
          );
        })}
      </div>
    </GlassCard>
  );
};

const TAGLIANDO_DOT_CLASSES = {
  urgente: "bg-danger-500",
  recordatorio: "bg-status-rischedulato",
};

// Vehiculos con Tagliando urgente o proximo (nunca "ok" - esos no necesitan aviso),
// mas urgentes primero y despues por km restante ascendente.
const TagliandoPanel = ({ vehicles }) => {
  const pending = vehicles
    ?.map((v) => ({ vehicle: v, status: getTagliandoStatus(v.kmUltimoMantenimiento, v.kmActual) }))
    .filter((item) => item.status && item.status.level !== "ok")
    .sort((a, b) => {
      if (a.status.level !== b.status.level) return a.status.level === "urgente" ? -1 : 1;
      return a.status.restante - b.status.restante;
    });

  return (
    <GlassCard className="flex flex-col !p-4 lg:max-h-[45vh]">
      <h2 className="px-1 text-[15px] font-semibold text-ink-50">Tagliando</h2>
      <p className="mb-3 px-1 text-[12px] text-ink-400">Vehiculos que necesitan mantenimiento pronto.</p>

      <div className="flex flex-col gap-2 overflow-y-auto">
        {pending === undefined && (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
          </div>
        )}
        {pending?.length === 0 && (
          <p className="py-3 text-center text-[13px] text-ink-300">Ningun vehiculo necesita Tagliando pronto.</p>
        )}
        {pending?.map(({ vehicle, status }) => (
          <Link
            key={vehicle.id}
            to={`/vehiculos/${vehicle.id}`}
            className="flex items-center gap-2.5 rounded-xl glass-surface-sm px-3 py-2.5 text-[13px] transition-colors hover:bg-line/[0.08]"
          >
            <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", TAGLIANDO_DOT_CLASSES[status.level])} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink-50">
                {vehicle.targa} - {vehicle.modelo}
              </p>
              <p className="truncate text-[12px] text-ink-400">
                {TAGLIANDO_STATUS_LABELS[status.level]} - {Math.round(status.restante).toLocaleString("es-AR")} km
                restantes
              </p>
            </div>
          </Link>
        ))}
      </div>
    </GlassCard>
  );
};

// Top de vehiculos por KM recorrido este mes (planificado o real, ver
// computeFleetKmUsage) - misma lista que se mostraba antes en el dashboard.
const FleetRankingPanel = ({ records }) => {
  const ranking = records ? computeFleetKmUsage(records, "mes").slice(0, 10) : undefined;

  return (
    <GlassCard className="flex flex-col !p-4 lg:max-h-[45vh]">
      <h2 className="px-1 text-[15px] font-semibold text-ink-50">Ranking de flota</h2>
      <p className="mb-3 px-1 text-[12px] text-ink-400">KM recorridos este mes, de mayor a menor.</p>

      <div className="flex flex-col gap-2 overflow-y-auto">
        {ranking === undefined && (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
          </div>
        )}
        {ranking?.length === 0 && (
          <p className="py-3 text-center text-[13px] text-ink-300">Sin servicios este mes todavia.</p>
        )}
        {ranking?.map((entry, idx) => (
          <Link
            key={entry.id}
            to={`/vehiculos/${entry.id}`}
            className="flex items-center gap-3 rounded-xl glass-surface-sm px-3 py-2 text-[13px] transition-colors hover:bg-line/[0.08]"
          >
            <span className="w-4 shrink-0 text-center text-[12px] font-medium text-ink-400">{idx + 1}</span>
            <span className="min-w-0 flex-1 truncate text-ink-50">{entry.nombre}</span>
            <span className="shrink-0 text-[12px] text-ink-300">
              {Math.round(entry.km).toLocaleString("es-AR")} km
            </span>
          </Link>
        ))}
      </div>
    </GlassCard>
  );
};

export const VehiclesPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [vehicles, setVehicles] = useState(null);
  const [monthlyRecords, setMonthlyRecords] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPrivileged) return;
    listVehiclesRequest()
      .then(setVehicles)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged]);

  useEffect(() => {
    if (!isPrivileged) return;
    const now = new Date();
    listRecordsByMonthRequest(now.getFullYear(), now.getMonth() + 1)
      .then(setMonthlyRecords)
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          <div className="flex flex-col gap-8">
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
          </div>

          <div className="flex flex-col gap-4">
            <DocumentAlertsPanel vehicles={vehicles} />
            <TagliandoPanel vehicles={vehicles} />
            <FleetRankingPanel records={monthlyRecords} />
          </div>
        </div>
      )}
    </div>
  );
};
