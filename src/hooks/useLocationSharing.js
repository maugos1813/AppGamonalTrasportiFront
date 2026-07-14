import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { listRecordsRequest } from "../lib/records.api";
import { updateMyLocationRequest } from "../lib/users.api";

// Solo existe implementacion nativa (Android/iOS); en el navegador normal no se usa.
const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

const CHECK_INTERVAL_MS = 20000;

// Horario laboral segun contrato: lunes a sabado de 7:00 a 19:00 (hora local).
const isWithinWorkSchedule = () => {
  const now = new Date();
  const day = now.getDay(); // 0=domingo ... 6=sabado
  const hour = now.getHours();
  const isWorkDay = day >= 1 && day <= 6;
  const isWorkHour = hour >= 7 && hour < 19;
  return isWorkDay && isWorkHour;
};

// Comparte la ubicacion del chofer mientras tiene un servicio IN_CONSEGNA activo, y
// ademas se cumple una de estas dos condiciones: esta dentro del horario laboral
// (lunes a sabado, 7:00 a 19:00), o tiene activado manualmente el switch "Compartir
// ubicacion GPS" de su perfil (compartirUbicacion) para servicios fuera de horario.
// Dentro del APK (Capacitor) usa el plugin nativo de background geolocation, que sigue
// funcionando con la app minimizada o la pantalla bloqueada (muestra una notificacion
// persistente, obligatoria en Android). En la version web normal solo funciona
// mientras la pestania esta abierta y visible.
export const useLocationSharing = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.cargo !== "CHOFER") return;

    let cancelled = false;
    let watcherId = null;

    const hasActiveService = async () => {
      const records = await listRecordsRequest();
      return records.some((r) => r.estado === "IN_CONSEGNA");
    };

    const startNativeTracking = async () => {
      if (watcherId != null) return;
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage:
            "Gamonal Trasporti esta compartiendo tu ubicacion mientras tenes un servicio en camino.",
          backgroundTitle: "Servicio en camino",
          requestPermissions: true,
          stale: false,
          distanceFilter: 30,
        },
        (location, error) => {
          if (error || !location) return;
          updateMyLocationRequest(location.latitude, location.longitude).catch(() => {});
        }
      );
    };

    const stopNativeTracking = () => {
      if (watcherId == null) return;
      BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
      watcherId = null;
    };

    const sendLocationOnceWeb = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateMyLocationRequest(position.coords.latitude, position.coords.longitude).catch(
            () => {}
          );
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const tick = async () => {
      try {
        const canShare = isWithinWorkSchedule() || user?.compartirUbicacion;
        if (!canShare) {
          stopNativeTracking();
          return;
        }

        const active = await hasActiveService();
        if (cancelled) return;

        if (Capacitor.isNativePlatform()) {
          if (active) await startNativeTracking();
          else stopNativeTracking();
        } else if (active) {
          sendLocationOnceWeb();
        }
      } catch {
        // silencioso: la ubicacion nunca debe romper el resto de la app
      }
    };

    tick();
    const intervalId = setInterval(tick, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      stopNativeTracking();
    };
  }, [user?.cargo, user?.compartirUbicacion]);
};
