import { Capacitor, registerPlugin } from "@capacitor/core";
import { useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { StatCard } from "../../components/ui/StatCard";
import { Switch } from "../../components/ui/Switch";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, CARGO_LABELS } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import { updateUserRequest } from "../../lib/users.api";

const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

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
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Mi perfil</h1>
        <p className="mt-1 text-[14px] text-ink-300">Tu informacion dentro de Gamonal Trasporti.</p>
      </div>

      <GlassCard>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-xl font-semibold text-accent-300">
            {user?.nombre?.[0]}
            {user?.apellido?.[0]}
          </div>
          <div>
            <h2 className="text-[22px] font-semibold text-ink-50">
              {user?.nombre} {user?.apellido}
            </h2>
            <p className="text-[14px] text-ink-300">{user?.correoElectronico}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Cargo" value={CARGO_LABELS[user?.cargo] ?? user?.cargo} tone="blue" />
          <StatCard label="Area" value={areaLabel(user?.area)} />
          <StatCard
            label="Estado de la cuenta"
            value={user?.estado === "ACTIVO" ? "Activo" : "Inactivo"}
            tone={user?.estado === "ACTIVO" ? "green" : "red"}
          />
          <StatCard label="Numero de celular" value={user?.numeroCelular} />
          <StatCard label="Fecha de nacimiento" value={formatDate(user?.fechaNacimiento)} />
          <StatCard label="Miembro desde" value={formatDate(user?.createdAt)} />
        </div>

        {user?.cargo === "CHOFER" && (
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
          </div>
        )}
      </GlassCard>
    </div>
  );
};
