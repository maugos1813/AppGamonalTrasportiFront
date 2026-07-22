import clsx from "clsx";
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
import { computeDriverDocumentAlerts, computeDriverKmRanking } from "../../lib/dashboardStats";
import { listDocumentsRequest } from "../../lib/documents.api";
import { listRecordsByMonthRequest } from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

const PhoneIcon = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.6 2.5c.4 0 .77.25.9.63l.85 2.36c.13.36.03.77-.25 1.03l-1.3 1.2c-.2.18-.25.47-.13.71a10.9 10.9 0 0 0 4.9 4.9c.24.12.53.07.71-.13l1.2-1.3c.26-.28.67-.38 1.03-.25l2.36.85c.38.13.63.5.63.9v2.05c0 1.02-.94 1.77-1.93 1.5A15.9 15.9 0 0 1 3.55 5.43a15.7 15.7 0 0 1-.55-3c0-.99.75-1.93 1.5-1.93H6.6z" />
  </svg>
);

// Card compacta: pensada para verse bien en grillas de 2 (mobile) a 4 (desktop
// grande) columnas, asi que prioriza nombre/estado y deja el resto en una sola
// fila chica en vez del layout mas espacioso de antes (2 en fila, siempre).
const DriverCard = ({ driver }) => (
  <Link to={`/choferes/${driver.id}`} className="block">
    <GlassCard className="!p-4 transition-colors hover:bg-line/[0.09]">
      <div className="flex items-center gap-3">
        <Avatar user={driver} className="h-10 w-10 shrink-0 text-[13px]" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-medium text-ink-50">
            {driver.nombre} {driver.apellido}
          </h2>
          <p className="truncate text-[12px] text-ink-300">{driver.correoElectronico}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-ink-400">{areaLabel(driver.area)}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              driver.estado === "ACTIVO"
                ? "border-success-500/25 bg-success-500/15 text-success-500"
                : "border-danger-500/25 bg-danger-500/15 text-danger-500"
            }`}
          >
            {driver.estado === "ACTIVO" ? "Activo" : "Inactivo"}
          </span>
          {driver.numeroCelular && (
            <a
              href={`tel:${driver.numeroCelular.replace(/\s+/g, "")}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Llamar a ${driver.nombre} ${driver.apellido}`}
              title="Llamar"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-success-500 hover:bg-success-500/25"
            >
              <PhoneIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </GlassCard>
  </Link>
);

// @container (no breakpoints de viewport): la grilla vive en una columna de 2/3 de
// pantalla, no en el ancho completo - ver el mismo ajuste en VehiclesPage.
const GroupSection = ({ title, members }) => (
  <div className="@container flex flex-col gap-4">
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
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @md:grid-cols-3 @xl:grid-cols-4">
        {members.map((driver) => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
      </div>
    )}
  </div>
);

// Top de choferes por KM recorrido este mes (planificado o real, ver
// computeDriverKmRanking) - misma logica que se usaba antes en el dashboard.
const DriverRankingPanel = ({ records }) => {
  const ranking = records ? computeDriverKmRanking(records, "mes").slice(0, 10) : undefined;

  return (
    <GlassCard className="flex flex-col !p-4 lg:max-h-[45vh]">
      <h2 className="px-1 text-[15px] font-semibold text-ink-50">Ranking de choferes</h2>
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
            to={`/choferes/${entry.id}`}
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

// Documentos de choferes por vencer (naranja) o ya vencidos (rojo) - misma logica
// que alimenta la campanita de notificaciones (computeDriverDocumentAlerts).
const DriverDocumentAlertsPanel = ({ users, documents }) => {
  const alerts = users && documents ? computeDriverDocumentAlerts(documents, users) : undefined;

  return (
    <GlassCard className="flex flex-col !p-4 lg:max-h-[45vh]">
      <h2 className="px-1 text-[15px] font-semibold text-ink-50">Documentos</h2>
      <p className="mb-3 px-1 text-[12px] text-ink-400">Choferes con documentos por vencer o vencidos.</p>

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

export const DriversPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [drivers, setDrivers] = useState(null);
  const [monthlyRecords, setMonthlyRecords] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPrivileged) return;
    listUsersRequest()
      .then(setDrivers)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged]);

  useEffect(() => {
    if (!isPrivileged) return;
    const now = new Date();
    listRecordsByMonthRequest(now.getFullYear(), now.getMonth() + 1)
      .then(setMonthlyRecords)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged]);

  useEffect(() => {
    if (!isPrivileged) return;
    listDocumentsRequest()
      .then(setDocuments)
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
          <Spinner className="h-6 w-6 border-line/20 border-t-line" />
        </div>
      )}

      {drivers?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          Todavia no hay choferes cargados.
        </GlassCard>
      )}

      {drivers !== null && drivers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          <div className="flex flex-col gap-8">
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
          </div>

          <div className="flex flex-col gap-4">
            <DriverRankingPanel records={monthlyRecords} />
            <DriverDocumentAlertsPanel users={drivers} documents={documents} />
          </div>
        </div>
      )}
    </div>
  );
};
