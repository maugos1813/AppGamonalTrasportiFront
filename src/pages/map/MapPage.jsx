import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { EN_PROCESO_STATUSES } from "../../lib/constants";
import { addMinutes } from "../../lib/format";
import { listRecordsRequest } from "../../lib/records.api";
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
const STATIC_ROUTE_COLOR = "#3987e5";
const LIVE_ROUTE_COLOR = "#22c55e";
const DESTINATION_COLOR = "#f59e0b";

// Centra y ajusta el zoom del mapa para que la ruta seleccionada (que ya incluye la
// posicion del chofer como primer punto) quede completamente visible. Solo se
// reajusta cuando cambia la seleccion (routeKey), no en cada refresco de datos, para
// no pelearse con el pan/zoom manual del usuario mientras mira el mapa.
const FitToRoute = ({ positions, routeKey }) => {
  const map = useMap();

  useEffect(() => {
    if (!positions?.length) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routeKey]);

  return null;
};

const minutesAgo = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
};

export const MapPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [locations, setLocations] = useState(null);
  const [records, setRecords] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
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
      listRecordsRequest()
        .then((data) => {
          if (!cancelled) setRecords(data);
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

  const pendingRecords = (records ?? [])
    .filter((r) => EN_PROCESO_STATUSES.includes(r.estado))
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

  const findLiveLocation = (record) =>
    locations?.find((loc) => loc.servicio?.driverId === record?.driver?.id);

  const selectedRecord = pendingRecords.find((r) => r.id === selectedRecordId);
  const selectedLiveEta = findLiveLocation(selectedRecord)?.etaEnVivo;
  const selectedRouteGeometry = selectedLiveEta?.geometria ?? selectedRecord?.ruta?.geometria;
  const selectedRoutePositions = selectedRouteGeometry?.coordinates?.map(
    ([lon, lat]) => [lat, lon]
  );
  const selectedDestination = selectedRecord?.stops?.[selectedRecord.stops.length - 1];

  return (
    <div className="flex flex-col gap-4">
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
        <div className="h-[calc(100dvh-300px)] min-h-[420px] w-full sm:h-[calc(100dvh-260px)]">
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
                    <br />
                    {loc.etaEnVivo ? (
                      <>
                        <strong>En vivo:</strong> le faltan ~{Math.round(loc.etaEnVivo.duracionMin)} min (
                        {loc.etaEnVivo.distanciaKm.toFixed(1)} km)
                      </>
                    ) : (
                      "ETA en vivo no disponible"
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
            {selectedRoutePositions && (
              <>
                <Polyline
                  positions={selectedRoutePositions}
                  pathOptions={{ color: selectedLiveEta ? LIVE_ROUTE_COLOR : STATIC_ROUTE_COLOR, weight: 4 }}
                />
                <FitToRoute positions={selectedRoutePositions} routeKey={selectedRecordId} />
              </>
            )}
            {selectedDestination?.lat != null && selectedDestination?.lng != null && (
              <CircleMarker
                center={[selectedDestination.lat, selectedDestination.lng]}
                radius={8}
                pathOptions={{ color: DESTINATION_COLOR, fillColor: DESTINATION_COLOR, fillOpacity: 0.8 }}
              >
                <Popup>Destino: {selectedDestination.direccion}</Popup>
              </CircleMarker>
            )}
          </MapContainer>
        </div>
      </div>

      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Pronostico de llegada</h2>
        <p className="mt-1 text-[13px] text-ink-300">
          Servicios pendientes. Si el chofer ya esta en camino, se muestra el tiempo en vivo desde su
          ubicacion actual; si todavia no salio, se muestra el estimado planificado. Toca uno para ver la
          ruta en el mapa.
        </p>

        {pendingRecords.length === 0 && (
          <p className="mt-4 text-[14px] text-ink-300">No hay servicios pendientes.</p>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {pendingRecords.map((record) => {
            const liveEta = findLiveLocation(record)?.etaEnVivo;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedRecordId(record.id === selectedRecordId ? null : record.id)
                  }
                  className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-[14px] transition-colors ${
                    record.id === selectedRecordId
                      ? "bg-accent-500/20 text-ink-50"
                      : "glass-surface-sm text-ink-200 hover:bg-line/10"
                  }`}
                >
                  <span>
                    <strong>{record.codigo}</strong> - {record.destinazione}
                  </span>
                  {liveEta ? (
                    <span className="text-[13px] text-emerald-400">
                      En vivo: {liveEta.distanciaKm.toFixed(1)} km - {Math.round(liveEta.duracionMin)} min -
                      llega ~{addMinutes(new Date(), liveEta.duracionMin)}
                    </span>
                  ) : record.ruta?.duracionMin != null ? (
                    <span className="text-[13px] text-ink-300">
                      {record.ruta.distanciaKm.toFixed(1)} km - {Math.round(record.ruta.duracionMin)} min -
                      llega ~{addMinutes(record.fechaServicio, record.ruta.duracionMin)}
                    </span>
                  ) : (
                    <span className="text-[13px] text-ink-400">ETA no disponible</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </div>
  );
};
