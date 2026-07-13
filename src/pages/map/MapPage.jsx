import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { listDriverLocationsRequest } from "../../lib/users.api";

// Vite rompe las URLs por defecto de los iconos de Leaflet; se apuntan a mano.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const MILAN_CENTER = [45.4642, 9.19];
const REFRESH_INTERVAL_MS = 20000;

const minutesAgo = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
};

export const MapPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [locations, setLocations] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPrivileged) return;

    let cancelled = false;
    const load = () => {
      listDriverLocationsRequest()
        .then((data) => {
          if (!cancelled) setLocations(data);
        })
        .catch((err) => {
          if (!cancelled) setError(parseApiError(err).message);
        });
    };

    load();
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isPrivileged]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const center =
    locations && locations.length > 0 ? [locations[0].lat, locations[0].lng] : MILAN_CENTER;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Mapa</h1>
        <p className="mt-1 text-[14px] text-ink-300">
          Choferes con un servicio en camino ahora mismo.
        </p>
      </div>

      <Alert>{error}</Alert>

      {locations?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          Ningun chofer esta compartiendo su ubicacion en este momento.
        </GlassCard>
      )}

      <div className="glass-surface overflow-hidden rounded-3xl">
        <div className="h-[70vh] w-full">
          <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {locations?.map((loc) => (
              <Marker key={loc.id} position={[loc.lat, loc.lng]}>
                <Popup>
                  <div className="text-[13px]">
                    <strong>
                      {loc.nombre} {loc.apellido}
                    </strong>
                    <br />
                    {loc.servicio?.codigo} - {loc.servicio?.destinazione}
                    <br />
                    Actualizado hace {minutesAgo(loc.actualizada)} min
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
