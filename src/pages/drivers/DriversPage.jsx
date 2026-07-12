import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, GRUPO_OPTIONS } from "../../lib/constants";
import { listUsersRequest } from "../../lib/users.api";

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

const PhoneIcon = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.6 2.5c.4 0 .77.25.9.63l.85 2.36c.13.36.03.77-.25 1.03l-1.3 1.2c-.2.18-.25.47-.13.71a10.9 10.9 0 0 0 4.9 4.9c.24.12.53.07.71-.13l1.2-1.3c.26-.28.67-.38 1.03-.25l2.36.85c.38.13.63.5.63.9v2.05c0 1.02-.94 1.77-1.93 1.5A15.9 15.9 0 0 1 3.55 5.43a15.7 15.7 0 0 1-.55-3c0-.99.75-1.93 1.5-1.93H6.6z" />
  </svg>
);

const DriverCard = ({ driver }) => (
  <Link to={`/choferes/${driver.id}`} className="block">
    <GlassCard className="transition-colors hover:bg-white/[0.09]">
      <div className="flex items-center gap-4">
        <Avatar user={driver} className="h-12 w-12 text-[15px]" />
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-medium text-ink-50">
            {driver.nombre} {driver.apellido}
          </h2>
          <p className="truncate text-[13px] text-ink-300">{driver.correoElectronico}</p>
        </div>
        <span
          className={`ml-auto shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium ${
            driver.estado === "ACTIVO"
              ? "border-success-500/25 bg-success-500/15 text-[#4ddb6e]"
              : "border-danger-500/25 bg-danger-500/15 text-[#ff6961]"
          }`}
        >
          {driver.estado === "ACTIVO" ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <span className="block text-ink-400">Area</span>
          <span className="text-ink-50">{areaLabel(driver.area)}</span>
        </div>
        <div>
          <span className="block text-ink-400">Celular</span>
          <div className="flex items-center gap-2">
            <span className="text-ink-50">{driver.numeroCelular}</span>
            {driver.numeroCelular && (
              <a
                href={`tel:${driver.numeroCelular.replace(/\s+/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Llamar a ${driver.nombre} ${driver.apellido}`}
                title="Llamar"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-[#4ddb6e] hover:bg-success-500/25"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
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
        ({members.length} {members.length === 1 ? "chofer" : "choferes"})
      </span>
    </h2>
    {members.length === 0 ? (
      <GlassCard className="text-center text-[14px] text-ink-300">
        Todavia no hay nadie asignado a este grupo.
      </GlassCard>
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {members.map((driver) => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
      </div>
    )}
  </div>
);

export const DriversPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [drivers, setDrivers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPrivileged) return;
    listUsersRequest()
      .then(setDrivers)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const activeUsers = drivers?.filter((u) => u.estado === "ACTIVO") ?? [];
  const inactiveUsers = drivers?.filter((u) => u.estado !== "ACTIVO") ?? [];
  const unassignedUsers = activeUsers.filter((u) => !u.grupo);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Choferes</h1>
          <p className="mt-1 text-[14px] text-ink-300">Equipo de choferes de Gamonal Trasporti.</p>
        </div>
        <Link to="/choferes/new">
          <Button className="w-auto px-5">Nuevo chofer</Button>
        </Link>
      </div>

      <Alert>{error}</Alert>

      {drivers === null && !error && (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 border-white/20 border-t-white" />
        </div>
      )}

      {drivers?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          Todavia no hay choferes cargados.
        </GlassCard>
      )}

      {drivers !== null && drivers.length > 0 && (
        <>
          {GRUPO_OPTIONS.map((grupo) => (
            <GroupSection
              key={grupo.value}
              title={grupo.label.toUpperCase()}
              members={activeUsers.filter((u) => u.grupo === grupo.value)}
            />
          ))}

          {unassignedUsers.length > 0 && (
            <GroupSection title="SIN GRUPO ASIGNAR" members={unassignedUsers} />
          )}

          {inactiveUsers.length > 0 && (
            <GroupSection title="INACTIVOS" members={inactiveUsers} />
          )}
        </>
      )}
    </div>
  );
};
