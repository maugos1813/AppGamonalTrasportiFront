import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ServicesTrendChart } from "../../components/charts/ServicesTrendChart";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Switch } from "../../components/ui/Switch";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, CARGO_LABELS } from "../../lib/constants";
import {
  computeDriverStats,
  computeEconomicStats,
  computeMyServiceCounts,
  computeServicePeriodStats,
  computeVehicleStats,
  computeWeeklyServiceTrend,
} from "../../lib/dashboardStats";
import { formatCurrencyCompact, formatDate } from "../../lib/format";
import { listRecordsRequest } from "../../lib/records.api";
import { listUsersRequest, updateUserRequest, uploadUserAvatarRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos dias";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
};

// Pide el permiso de ubicacion correspondiente a la plataforma. En el APK dispara el
// flujo nativo (y si solo se otorgo "mientras se usa la app", manda a Configuracion
// para elegir "Permitir todo el tiempo"). En el navegador solo existe el permiso
// estandar del sitio, no hay un equivalente a "siempre".
const requestLocationPermission = () =>
  new Promise((resolve) => {
    if (Capacitor.isNativePlatform()) {
      let watcherId;
      BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Gamonal Trasporti puede compartir tu ubicacion durante tu horario laboral.",
          backgroundTitle: "Compartir ubicacion",
          requestPermissions: true,
          stale: true,
        },
        (location, error) => {
          if (error) {
            if (error.code === "NOT_AUTHORIZED") {
              BackgroundGeolocation.openSettings();
            }
            resolve();
            return;
          }
          if (watcherId != null) {
            BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
          }
          resolve();
        }
      ).then((id) => {
        watcherId = id;
      });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        () => resolve(),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      resolve();
    }
  });

export const ProfilePage = () => {
  const { user, setUser } = useAuth();
  const isChofer = user?.cargo === "CHOFER";

  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // KPIs/grafico/actividad reciente: los mismos calculos ya usados en el Dashboard y
  // en Resumen (dashboardStats.js), nada nuevo. El backend ya filtra /records por
  // actor (un CHOFER solo recibe los suyos), asi que no hace falta filtrar a mano aca.
  const [records, setRecords] = useState(null);
  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    listRecordsRequest()
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(parseApiError(err).message);
      });

    if (!isChofer) {
      listUsersRequest()
        .then((data) => {
          if (!cancelled) setDrivers(data);
        })
        .catch((err) => {
          if (!cancelled) setLoadError(parseApiError(err).message);
        });
      listVehiclesRequest()
        .then((data) => {
          if (!cancelled) setVehicles(data);
        })
        .catch((err) => {
          if (!cancelled) setLoadError(parseApiError(err).message);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [isChofer]);

  const statsLoaded = isChofer ? Boolean(records) : Boolean(records && drivers && vehicles);

  const myCounts = useMemo(
    () => (isChofer && records ? computeMyServiceCounts(records) : null),
    [isChofer, records]
  );
  const servicePeriodStats = useMemo(
    () => (!isChofer && records ? computeServicePeriodStats(records, "hoy") : null),
    [isChofer, records]
  );
  const driverStats = useMemo(
    () => (!isChofer && records && drivers ? computeDriverStats(drivers, records) : null),
    [isChofer, records, drivers]
  );
  const vehicleStats = useMemo(
    () => (!isChofer && records && vehicles ? computeVehicleStats(vehicles, records) : null),
    [isChofer, records, vehicles]
  );
  const economicStats = useMemo(
    () => (!isChofer && records ? computeEconomicStats(records, "mes") : null),
    [isChofer, records]
  );
  const weeklyTrend = useMemo(() => (records ? computeWeeklyServiceTrend(records) : []), [records]);
  const recentRecords = useMemo(
    () =>
      records
        ? [...records].sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio)).slice(0, 5)
        : [],
    [records]
  );

  const handleToggleLocationSharing = async (checked) => {
    setSavingLocation(true);
    setLocationError("");
    try {
      if (checked) {
        await requestLocationPermission();
      }
      const updated = await updateUserRequest(user.id, { compartirUbicacion: checked });
      setUser(updated);
    } catch (err) {
      setLocationError(parseApiError(err).message);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarUploading(true);
    setAvatarError("");
    try {
      const updated = await uploadUserAvatarRequest(user.id, file);
      setUser(updated);
    } catch (err) {
      setAvatarError(parseApiError(err).message);
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">
          {greeting()}, {user?.nombre}!
        </h1>
        <p className="mt-1 text-[14px] text-ink-300">
          {isChofer ? "Tu resumen personal en Gamonal Trasporti." : "Resumen de la operacion."}
        </p>
      </div>

      <GlassCard>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar user={user} className={`h-20 w-20 text-2xl ${user?.imagenUrl ? "" : "opacity-40"}`} />
          <div>
            <h2 className="text-[22px] font-semibold text-ink-50">
              {user?.nombre} {user?.apellido}
            </h2>
            <p className="text-[14px] text-ink-300">{user?.correoElectronico}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-accent-500/15 px-2.5 py-1 text-[11px] font-medium uppercase text-accent-300">
                {CARGO_LABELS[user?.cargo] ?? user?.cargo}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase ${
                  user?.estado === "ACTIVO"
                    ? "bg-success-500/15 text-success-500"
                    : "bg-danger-500/15 text-danger-500"
                }`}
              >
                {user?.estado === "ACTIVO" ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-2 sm:items-start">
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full glass-input px-4 py-2 text-[13px] font-medium text-ink-50 hover:bg-line/10">
            {avatarUploading ? <Spinner /> : "Cambiar foto de perfil"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={avatarUploading}
            />
          </label>
          {avatarError && <span className="text-[13px] text-danger-500">{avatarError}</span>}
        </div>
      </GlassCard>

      <Alert>{loadError}</Alert>

      {!statsLoaded && <PageLoader />}

      {statsLoaded && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isChofer ? (
              <>
                <StatCard label="Servicios hoy" value={myCounts.hoy} tone="blue" />
                <StatCard label="Pendientes" value={myCounts.pendientes} tone="amber" />
                <StatCard label="Completados" value={myCounts.completados} tone="green" />
                <StatCard label="Cancelados" value={myCounts.cancelados} tone="red" />
              </>
            ) : (
              <>
                <StatCard label="Servicios hoy" value={servicePeriodStats.total} tone="blue" />
                <StatCard label="Choferes activos" value={driverStats.activos} tone="blue" />
                <StatCard label="Vehiculos disponibles" value={vehicleStats.disponibles} tone="green" />
                <StatCard
                  label="Facturacion del mes"
                  value={formatCurrencyCompact(economicStats.facturacion)}
                  tone="green"
                />
              </>
            )}
          </div>

          <GlassCard>
            <h2 className="text-[15px] font-semibold text-ink-50">Servicios - ultimos 7 dias</h2>
            <div className="mt-3 h-[220px]">
              <ServicesTrendChart data={weeklyTrend} />
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="text-[15px] font-semibold text-ink-50">Servicios recientes</h2>
            {recentRecords.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-300">Todavia no hay servicios cargados.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5">
                {recentRecords.map((record) => (
                  <li key={record.id}>
                    <Link
                      to={`/records/${record.id}`}
                      className="flex items-center gap-3 rounded-xl glass-surface-sm px-3 py-2.5 text-[13px] transition-colors hover:bg-line/[0.08]"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink-50">
                        {record.codigo} <span className="text-ink-400">- {record.destinazione}</span>
                      </span>
                      <span className="hidden shrink-0 text-[12px] text-ink-400 sm:inline">
                        {formatDate(record.fechaServicio)}
                      </span>
                      <StatusBadge status={record.estado} className="shrink-0 px-2 py-0.5 text-[10px]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </>
      )}

      <GlassCard>
        <h2 className="text-[15px] font-semibold text-ink-50">Datos de la cuenta</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Area" value={areaLabel(user?.area)} />
          <StatCard label="Numero de celular" value={user?.numeroCelular} />
          <StatCard label="Fecha de nacimiento" value={formatDate(user?.fechaNacimiento)} />
          <StatCard label="Miembro desde" value={formatDate(user?.createdAt)} />
        </div>

        {isChofer && (
          <div className="mt-6 border-t border-line/10 pt-6">
            <Alert>{locationError}</Alert>

            {user?.ubicacionPermisoDenegado && (
              <div className="mb-4 flex flex-col gap-2 rounded-xl border border-danger-500/25 bg-danger-500/10 px-4 py-3 text-[13px] text-danger-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  El permiso de ubicacion no esta en "Permitir todo el tiempo": el GPS deja de
                  compartirse apenas apagas la pantalla o salis de la app.
                </span>
                {Capacitor.isNativePlatform() && (
                  <button
                    type="button"
                    onClick={() => BackgroundGeolocation.openSettings()}
                    className="shrink-0 rounded-lg border border-danger-500/40 px-3 py-1.5 text-[13px] font-medium hover:bg-danger-500/15"
                  >
                    Abrir configuracion
                  </button>
                )}
              </div>
            )}

            <Switch
              id="compartir-ubicacion"
              label="Compartir ubicacion GPS"
              description="De lunes a sabado de 7:00 a 19:00 tu ubicacion se comparte automaticamente durante un servicio en camino. Fuera de ese horario, activa este switch si te sale un servicio."
              checked={Boolean(user?.compartirUbicacion)}
              disabled={savingLocation}
              onChange={handleToggleLocationSharing}
            />

            {Capacitor.isNativePlatform() && (
              <div className="mt-4 flex flex-col gap-2 rounded-xl glass-surface-sm px-4 py-3 text-[13px] text-ink-300 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Algunos celulares (Xiaomi, Huawei, Samsung, Oppo/Vivo, entre otros) apagan solos el
                  GPS en segundo plano para ahorrar bateria, aunque sigas trabajando. Para evitarlo,
                  entra a la configuracion de la app y elegi "Sin restricciones" en Bateria. Cerrar la
                  app a proposito (deslizandola de recientes) sigue apagando el GPS al instante, como
                  corresponde cuando termines tu jornada.
                </span>
                <button
                  type="button"
                  onClick={() => BackgroundGeolocation.openSettings()}
                  className="shrink-0 rounded-lg border border-line/20 px-3 py-1.5 text-[13px] font-medium hover:bg-ink-500/10"
                >
                  Abrir configuracion
                </button>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
};
