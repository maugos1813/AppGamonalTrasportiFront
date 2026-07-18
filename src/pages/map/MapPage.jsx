import { GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { EN_PROCESO_STATUSES } from "../../lib/constants";
import { addMinutes } from "../../lib/format";
import { listRecordsRequest } from "../../lib/records.api";
import { listDriverLocationsRequest } from "../../lib/users.api";

// Modulo estable fuera del componente: si se recrea en cada render, useJsApiLoader
// recarga el script de Google Maps una y otra vez.
const GOOGLE_MAPS_LIBRARIES = [];

const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };
const REFRESH_INTERVAL_MS = 20000;
const STATIC_ROUTE_COLOR = "#3987e5";
const LIVE_ROUTE_COLOR = "#22c55e";
const DESTINATION_COLOR = "#f59e0b";
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const minutesAgo = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
};

export const MapPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [map, setMap] = useState(null);
  const [openInfoId, setOpenInfoId] = useState(null);

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

  const pendingRecords = (records ?? [])
    .filter((r) => EN_PROCESO_STATUSES.includes(r.estado))
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

  const findLiveLocation = (record) =>
    locations?.find((loc) => loc.servicio?.driverId === record?.driver?.id);

  const selectedRecord = pendingRecords.find((r) => r.id === selectedRecordId);
  const selectedLiveEta = findLiveLocation(selectedRecord)?.etaEnVivo;
  const selectedRouteGeometry = selectedLiveEta?.geometria ?? selectedRecord?.ruta?.geometria;
  const selectedRoutePositions = useMemo(
    () => selectedRouteGeometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })),
    [selectedRouteGeometry]
  );
  const selectedDestination = selectedRecord?.stops?.[selectedRecord.stops.length - 1];

  // Centra y ajusta el zoom del mapa para que la ruta seleccionada (que ya incluye la
  // posicion del chofer como primer punto) quede completamente visible. Solo se
  // reajusta cuando cambia la seleccion, no en cada refresco de datos, para no
  // pelearse con el pan/zoom manual del usuario mientras mira el mapa.
  useEffect(() => {
    if (!map || !selectedRoutePositions?.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    selectedRoutePositions.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedRecordId]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const center =
    locations && locations.length > 0
      ? { lat: locations[0].lat, lng: locations[0].lng }
      : MILAN_CENTER;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Mapa</h1>
        <p className="mt-1 text-[14px] text-ink-300">
          Choferes con un servicio en camino ahora mismo.
        </p>
      </div>

      <Alert>{error || (loadError ? "No se pudo cargar Google Maps." : "")}</Alert>

      {locations?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          Ningun chofer esta compartiendo su ubicacion en este momento.
        </GlassCard>
      )}

      {/* En desktop (lg+) queda lista a la izquierda y mapa a la derecha, a la
          espera de que se elija un servicio pendiente; en mobile se apilan
          (lista primero, despues el mapa). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:items-start">
        <GlassCard className="lg:h-[calc(100dvh-220px)] lg:overflow-y-auto">
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
                    className={`flex w-full flex-col items-start gap-1 rounded-xl px-4 py-3 text-left text-[14px] transition-colors ${
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

        <div className="glass-surface overflow-hidden rounded-3xl">
          <div className="h-[calc(100dvh-300px)] min-h-[420px] w-full sm:h-[calc(100dvh-260px)] lg:h-[calc(100dvh-220px)]">
            {!isLoaded ? (
              <div className="flex h-full items-center justify-center">
                <Spinner className="h-6 w-6 border-line/20 border-t-line" />
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={center}
                zoom={12}
                onLoad={setMap}
                onUnmount={() => setMap(null)}
                options={{ streetViewControl: false, mapTypeControl: false }}
              >
                {locations?.map((loc) => (
                  <Marker
                    key={loc.id}
                    position={{ lat: loc.lat, lng: loc.lng }}
                    onClick={() => setOpenInfoId(loc.id)}
                  >
                    {openInfoId === loc.id && (
                      <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
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
                      </InfoWindow>
                    )}
                  </Marker>
                ))}

                {selectedRoutePositions && (
                  <Polyline
                    path={selectedRoutePositions}
                    options={{
                      strokeColor: selectedLiveEta ? LIVE_ROUTE_COLOR : STATIC_ROUTE_COLOR,
                      strokeWeight: 4,
                    }}
                  />
                )}

                {selectedDestination?.lat != null && selectedDestination?.lng != null && (
                  <Marker
                    position={{ lat: selectedDestination.lat, lng: selectedDestination.lng }}
                    onClick={() => setOpenInfoId("destination")}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: DESTINATION_COLOR,
                      fillOpacity: 0.8,
                      strokeColor: DESTINATION_COLOR,
                      strokeWeight: 1,
                    }}
                  >
                    {openInfoId === "destination" && (
                      <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
                        <div className="text-[13px]">Destino: {selectedDestination.direccion}</div>
                      </InfoWindow>
                    )}
                  </Marker>
                )}
              </GoogleMap>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
