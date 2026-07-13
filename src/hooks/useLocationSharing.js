import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { listRecordsRequest } from "../lib/records.api";
import { updateMyLocationRequest } from "../lib/users.api";

const UPDATE_INTERVAL_MS = 20000;

// Comparte la ubicacion del chofer solo mientras tiene un servicio IN_CONSEGNA y
// la app abierta (en background, la app web no puede seguir mandando ubicacion:
// eso requiere la version nativa/APK).
export const useLocationSharing = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.cargo !== "CHOFER" || !navigator.geolocation) return;

    let cancelled = false;

    const sendLocationIfActive = async () => {
      try {
        const records = await listRecordsRequest();
        if (cancelled) return;
        const hasActiveService = records.some((r) => r.estado === "IN_CONSEGNA");
        if (!hasActiveService) return;

        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateMyLocationRequest(position.coords.latitude, position.coords.longitude).catch(
              () => {}
            );
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } catch {
        // silencioso: la ubicacion nunca debe romper el resto de la app
      }
    };

    sendLocationIfActive();
    const intervalId = setInterval(sendLocationIfActive, UPDATE_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [user?.cargo]);
};
