import { GoogleMap, InfoWindow, Marker, Polygon, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { EN_PROCESO_STATUSES, TERMINADOS_STATUSES } from "../../lib/constants";
import { addMinutes, formatDateTime } from "../../lib/format";
import MILANO_ZONES from "../../lib/geo/milanoZones.json";
import { getRecordLiveEtaRequest, getRecordRequest, listRecordsRequest } from "../../lib/records.api";
import { getDriverReturnEtaRequest, listDriverLocationsRequest } from "../../lib/users.api";

// Modulo estable fuera del componente: si se recrea en cada render, useJsApiLoader
// recarga el script de Google Maps una y otra vez.
const GOOGLE_MAPS_LIBRARIES = [];

const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };
const REFRESH_INTERVAL_MS = 20000;
const STATIC_ROUTE_COLOR = "#3987e5";
const LIVE_ROUTE_COLOR = "#22c55e";
const DESTINATION_COLOR = "#f59e0b";
// Chofer con ubicacion fresca pero sin servicio "en camino" ahora mismo (volviendo de
// una entrega o esperando el proximo): mismo gris que el estado "En suspenso" en el
// resto de la app, para diferenciarlo del pin rojo por defecto de los que si reparten.
const IDLE_DRIVER_COLOR = "#6b7280";
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

// Perimetros oficiales de Area B y Area C (Comune di Milano, portal GIS
// gisportal.comune.milano.it - capas "Confine Area B" y "Confine Area C").
// Area B viene como MultiPolygon (el contorno grande mas varios enclaves chicos
// separados), por eso son varios "paths" en el mismo Polygon.
const AREA_C_COLOR = "#ef4444";
const AREA_B_COLOR = "#a855f7";
const AREA_C_PATH = MILANO_ZONES.areaC;
const AREA_B_PATHS = MILANO_ZONES.areaB;

const SECTION_OPTIONS = [
  { value: "pendientes", label: "Pendientes" },
  { value: "terminados", label: "Terminados" },
  { value: "choferes", label: "Choferes" },
];

// Filtro de categoria para "Terminados": agrupa DHL y AB Service juntos (misma
// distincion que ya se usa en toda la app para separar de Extras Piazza).
const CATEGORY_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "EXTRAS_PIAZZA", label: "Extras Piazza" },
  { value: "DHL_AB", label: "DHL / AB Service" },
];

const minutesAgo = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
};

// yyyy-MM-dd en horario LOCAL (no UTC, a diferencia de toDateInputValue/toISOString,
// que puede correr la fecha un dia segun el huso horario) - para que "hoy" por defecto
// sea realmente el dia de hoy para quien esta mirando el mapa.
const toLocalDateInputValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const isSameLocalDate = (dateValue, yyyyMmDd) => toLocalDateInputValue(new Date(dateValue)) === yyyyMmDd;

const matchesCategoryFilter = (record, categoryFilter) => {
  if (categoryFilter === "todos") return true;
  const isDhlAb = record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE";
  return categoryFilter === "DHL_AB" ? isDhlAb : !isDhlAb;
};

const PencilIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const MapPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [map, setMap] = useState(null);
  // Instancia nativa de la linea de ruta dibujada a mano (ver el useEffect mas abajo),
  // para poder borrarla explicitamente antes de dibujar la siguiente.
  const polylineRef = useRef(null);
  const [openInfoId, setOpenInfoId] = useState(null);
  const [showAreaC, setShowAreaC] = useState(true);
  const [showAreaB, setShowAreaB] = useState(true);
  const [section, setSection] = useState("pendientes");

  const [locations, setLocations] = useState(null);
  const [records, setRecords] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  // Filtro de "Terminados": por defecto el dia de hoy y todas las categorias.
  const [terminadosDate, setTerminadosDate] = useState(() => toLocalDateInputValue(new Date()));
  const [terminadosCategory, setTerminadosCategory] = useState("todos");
  // ETA en vivo del servicio seleccionado en la lista (ruta + linea en el mapa) y del
  // marcador que tiene el InfoWindow abierto (puede ser el mismo servicio u otro, o el
  // regreso de un chofer libre). Se piden a demanda -ver los 2 useEffect mas abajo-, no
  // se calculan para todos los choferes en cada refresco de posiciones: recalcular la
  // ruta de 30 choferes cada 20s aunque nadie los este mirando sale caro de mas.
  const [selectedLiveEta, setSelectedLiveEta] = useState(null);
  // Detalle completo (con stops geocodificados y el poligono de la ruta) del
  // servicio seleccionado en la lista - se pide a demanda (ver el useEffect mas
  // abajo), no viene en el listado general: ese trae todos los registros en cada
  // polling de 20s y no incluye ni stops ni el poligono para no volar el trafico
  // de Neon con datos que nadie esta mirando.
  const [selectedRecordDetail, setSelectedRecordDetail] = useState(null);
  // undefined = todavia no se pidio nada, null = se pidio pero no hay ETA disponible.
  const [openMarkerEta, setOpenMarkerEta] = useState(undefined);
  const [error, setError] = useState("");

  const changeSection = (value) => {
    setSection(value);
    setSelectedRecordId(null);
  };

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

  // Terminados: por defecto solo el dia de hoy (se puede cambiar con el filtro de
  // fecha) y todas las categorias, mas reciente primero (es historial, al reves que
  // pendientes).
  const finishedRecords = (records ?? [])
    .filter((r) => TERMINADOS_STATUSES.includes(r.estado))
    .filter((r) => isSameLocalDate(r.fechaServicio, terminadosDate))
    .filter((r) => matchesCategoryFilter(r, terminadosCategory))
    .sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio));

  const listRecords = section === "pendientes" ? pendingRecords : finishedRecords;

  // Vista "Choferes": una fila por chofer (no por servicio - un chofer con varias
  // entregas compactadas aparece varias veces en "locations", todas con la misma
  // posicion), solo para listar y centrar el mapa. Sin rutas ni ETA.
  const uniqueDrivers = useMemo(() => {
    const byId = new Map();
    (locations ?? []).forEach((loc) => {
      const existing = byId.get(loc.id);
      if (!existing) {
        byId.set(loc.id, { ...loc, serviciosCount: loc.servicio ? 1 : 0 });
      } else if (loc.servicio) {
        existing.serviciosCount += 1;
      }
    });
    return Array.from(byId.values()).sort((a, b) =>
      `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    );
  }, [locations]);

  const focusDriver = (loc) => {
    const markerId = loc.servicio?.id ?? `idle-${loc.id}`;
    setOpenInfoId(markerId);
    map?.panTo({ lat: loc.lat, lng: loc.lng });
    map?.setZoom(15);
  };

  // ETA en vivo del servicio elegido en la lista: se pide solo mientras ese servicio
  // sigue seleccionado, y se repite cada 20s para mantenerlo al dia - apenas se cambia
  // de seleccion o de seccion, se corta (no sigue pidiendo de fondo). En "Terminados"
  // nunca se pide (no tiene sentido, ya no hay ubicacion en vivo que mostrar).
  useEffect(() => {
    if (section !== "pendientes" || !selectedRecordId) {
      setSelectedLiveEta(null);
      return;
    }

    let cancelled = false;
    const fetchEta = () => {
      getRecordLiveEtaRequest(selectedRecordId)
        .then((eta) => {
          if (!cancelled) setSelectedLiveEta(eta);
        })
        .catch(() => {
          if (!cancelled) setSelectedLiveEta(null);
        });
    };

    fetchEta();
    const intervalId = setInterval(fetchEta, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedRecordId, section]);

  // Mismo patron para el marcador que tiene el InfoWindow abierto en el mapa (puede
  // ser un servicio en camino o un chofer libre volviendo a la base) - solo se pide
  // mientras ese InfoWindow sigue abierto. undefined = todavia no llego la primera
  // respuesta ("Calculando..."), null = ya se pidio pero no hay ETA disponible.
  useEffect(() => {
    if (section !== "pendientes" || !openInfoId || openInfoId === "destination") {
      setOpenMarkerEta(undefined);
      return;
    }

    setOpenMarkerEta(undefined);
    const isIdleDriver = openInfoId.startsWith("idle-");
    let cancelled = false;
    const fetchEta = () => {
      const request = isIdleDriver
        ? getDriverReturnEtaRequest(openInfoId.slice("idle-".length))
        : getRecordLiveEtaRequest(openInfoId);
      request
        .then((eta) => {
          if (!cancelled) setOpenMarkerEta(eta ?? null);
        })
        .catch(() => {
          if (!cancelled) setOpenMarkerEta(null);
        });
    };

    fetchEta();
    const intervalId = setInterval(fetchEta, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [openInfoId, section]);

  // Detalle completo del servicio seleccionado (stops + poligono de ruta): se pide
  // una sola vez al seleccionar, no se re-poll-ea (a diferencia de la ETA en vivo,
  // esto no cambia mientras se esta mirando el mapa).
  useEffect(() => {
    if (!selectedRecordId) {
      setSelectedRecordDetail(null);
      return;
    }

    let cancelled = false;
    getRecordRequest(selectedRecordId)
      .then((record) => {
        if (!cancelled) setSelectedRecordDetail(record);
      })
      .catch(() => {
        if (!cancelled) setSelectedRecordDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRecordId]);

  // selectedLiveEta ya queda en null en "Terminados" (el effect de arriba lo corta),
  // asi que ahi esto cae directo al recorrido planificado del formulario.
  const selectedRouteGeometry = selectedLiveEta?.geometria ?? selectedRecordDetail?.ruta?.geometria;
  const selectedRoutePositions = useMemo(
    () => selectedRouteGeometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })),
    [selectedRouteGeometry]
  );
  const selectedDestination = selectedRecordDetail?.stops?.[selectedRecordDetail.stops.length - 1];

  // Dibuja la ruta seleccionada a mano (sin el componente <Polyline>): asi se
  // controla directo la instancia nativa de Google Maps y se garantiza que nunca haya
  // 2 lineas superpuestas. Antes de dibujar la nueva (o si no queda nada
  // seleccionado), siempre se borra la anterior primero - asi cumple la regla de "solo
  // la linea del servicio actual, nunca la del anterior" al cambiar de seleccion, de
  // seccion (Pendientes/Terminados), o al pasar de ruta estatica a ETA en vivo.
  // @react-google-maps/api (el componente <Polyline> declarativo) no garantiza esto de
  // forma confiable al cambiar de instancia, sobre todo con StrictMode en desarrollo.
  useEffect(() => {
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!selectedRoutePositions?.length) return;

    polylineRef.current = new window.google.maps.Polyline({
      path: selectedRoutePositions,
      strokeColor: selectedLiveEta ? LIVE_ROUTE_COLOR : STATIC_ROUTE_COLOR,
      strokeWeight: 4,
      map,
    });

    return () => {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [map, selectedRoutePositions, selectedLiveEta]);

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

  const showsDriverLocations = section === "pendientes" || section === "choferes";

  const center =
    showsDriverLocations && locations && locations.length > 0
      ? { lat: locations[0].lat, lng: locations[0].lng }
      : MILAN_CENTER;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Mapa</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            {section === "pendientes"
              ? "Choferes compartiendo ubicacion ahora mismo: repartiendo o disponibles."
              : section === "terminados"
                ? "Recorrido planificado de servicios ya finalizados."
                : "Ubicacion actual de todos los choferes, sin rutas ni ETA."}
          </p>
        </div>
        <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={changeSection} />
      </div>

      <Alert>{error || (loadError ? "No se pudo cargar Google Maps." : "")}</Alert>

      {showsDriverLocations && locations?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          Ningun chofer esta compartiendo su ubicacion en este momento.
        </GlassCard>
      )}

      {/* En desktop (lg+) queda lista a la izquierda y mapa a la derecha, a la
          espera de que se elija un servicio pendiente; en mobile se apilan
          (lista primero, despues el mapa). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:items-start">
        <GlassCard className="lg:h-[calc(100dvh-220px)] lg:overflow-y-auto">
          {section === "choferes" ? (
            <>
              <h2 className="text-[17px] font-medium text-ink-50">Choferes</h2>
              <p className="mt-1 text-[13px] text-ink-300">
                Solo ubicacion, sin rutas ni ETA. Toca un chofer para centrarlo en el mapa.
              </p>

              {uniqueDrivers.length === 0 && (
                <p className="mt-4 text-[14px] text-ink-300">
                  Ningun chofer esta compartiendo su ubicacion en este momento.
                </p>
              )}

              <ul className="mt-4 flex flex-col gap-2">
                {uniqueDrivers.map((loc) => (
                  <li key={loc.id}>
                    <button
                      type="button"
                      onClick={() => focusDriver(loc)}
                      className="flex w-full flex-col items-start gap-1 rounded-xl glass-surface-sm px-4 py-3 text-left text-[14px] text-ink-200 transition-colors hover:bg-line/10"
                    >
                      <span className="font-medium text-ink-50">
                        {loc.nombre} {loc.apellido}
                      </span>
                      <span className="text-[13px] text-ink-300">
                        {loc.serviciosCount > 0
                          ? `En camino (${loc.serviciosCount} ${loc.serviciosCount === 1 ? "servicio" : "servicios"})`
                          : "Disponible"}
                        {" - "}
                        actualizado hace {minutesAgo(loc.actualizada)} min
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="text-[17px] font-medium text-ink-50">
                {section === "pendientes" ? "Pronostico de llegada" : "Servicios finalizados"}
              </h2>
              <p className="mt-1 text-[13px] text-ink-300">
                {section === "pendientes"
                  ? "Servicios pendientes. Si el chofer ya esta en camino, se muestra el tiempo en vivo desde su ubicacion actual; si todavia no salio, se muestra el estimado planificado. Toca uno para ver la ruta en el mapa."
                  : "Servicios entregados, retirados, anulados o reprogramados. Toca uno para ver en el mapa el recorrido planificado a partir de las direcciones cargadas (no la ubicacion en vivo del chofer)."}
              </p>

          {section === "terminados" && (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line/10 pt-4 sm:grid-cols-2">
              <TextField
                id="terminados-fecha"
                label="Fecha"
                type="date"
                value={terminadosDate}
                onChange={(e) => setTerminadosDate(e.target.value)}
              />
              <Select
                id="terminados-categoria"
                label="Categoria"
                options={CATEGORY_FILTER_OPTIONS}
                value={terminadosCategory}
                onChange={(e) => setTerminadosCategory(e.target.value)}
              />
            </div>
          )}

          {listRecords.length === 0 && (
            <p className="mt-4 text-[14px] text-ink-300">
              {section === "pendientes"
                ? "No hay servicios pendientes."
                : "No hay servicios finalizados para ese dia y esa categoria."}
            </p>
          )}

          <ul className="mt-4 flex flex-col gap-2">
            {listRecords.map((record) => {
              const isSelected = record.id === selectedRecordId;
              // El ETA en vivo solo se pidio para el servicio seleccionado (ver el
              // useEffect de mas arriba) - los demas siempre muestran el planificado.
              const liveEta = section === "pendientes" && isSelected ? selectedLiveEta : undefined;
              return (
                <li key={record.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedRecordId(isSelected ? null : record.id)}
                    className={`flex w-full flex-col items-start gap-1 rounded-xl px-4 py-3 text-left text-[14px] transition-colors ${
                      isSelected
                        ? "bg-accent-500/20 pr-12 text-ink-50"
                        : "glass-surface-sm text-ink-200 hover:bg-line/10"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>
                        <strong>{record.codigo}</strong> - {record.destinazione}
                      </span>
                      {section === "terminados" && <StatusBadge status={record.estado} />}
                    </span>
                    {section === "pendientes" ? (
                      liveEta ? (
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
                      )
                    ) : record.ruta?.duracionMin != null ? (
                      <span className="text-[13px] text-ink-300">
                        {record.ruta.distanciaKm.toFixed(1)} km - {Math.round(record.ruta.duracionMin)} min -{" "}
                        {formatDateTime(record.fechaServicio)}
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-400">
                        Ruta no disponible - {formatDateTime(record.fechaServicio)}
                      </span>
                    )}
                  </button>

                  {isSelected && (
                    // Abre el registro en el panel deslizante de siempre (derecha a
                    // izquierda), con state.from para que al cerrarlo vuelva al mapa
                    // en vez de a la lista de registros.
                    <Link
                      to={`/records/${record.id}`}
                      state={{ from: "/mapa" }}
                      aria-label="Editar ubicaciones del servicio"
                      title="Editar ubicaciones del servicio"
                      className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-accent-500/20 hover:text-accent-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/20"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
            </>
          )}
        </GlassCard>

        <div className="glass-surface relative overflow-hidden rounded-3xl">
          {isLoaded && (
            <div className="glass-surface-sm absolute right-3 top-3 z-10 flex flex-col gap-1.5 rounded-xl px-3 py-2 text-[12px] text-ink-200">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showAreaC}
                  onChange={(e) => setShowAreaC(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#ef4444]"
                />
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: AREA_C_COLOR }} />
                Area C
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showAreaB}
                  onChange={(e) => setShowAreaB(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#a855f7]"
                />
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: AREA_B_COLOR }} />
                Area B
              </label>
              {showsDriverLocations && (
                <div className="flex items-center gap-2 border-t border-line/10 pt-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: IDLE_DRIVER_COLOR }}
                  />
                  Chofer disponible
                </div>
              )}
            </div>
          )}
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
                {showAreaC && (
                  <Polygon
                    paths={AREA_C_PATH}
                    options={{
                      strokeColor: AREA_C_COLOR,
                      strokeWeight: 2,
                      fillColor: AREA_C_COLOR,
                      fillOpacity: 0.06,
                      clickable: false,
                      zIndex: 1,
                    }}
                  />
                )}

                {showAreaB && (
                  <Polygon
                    paths={AREA_B_PATHS}
                    options={{
                      strokeColor: AREA_B_COLOR,
                      strokeWeight: 2,
                      fillColor: AREA_B_COLOR,
                      fillOpacity: 0.05,
                      clickable: false,
                      zIndex: 0,
                    }}
                  />
                )}

                {showsDriverLocations && locations?.map((loc) => {
                  // key/estado por loc.servicio.id cuando hay servicio (un mismo chofer
                  // puede tener varias entradas si tiene mas de un servicio "en camino"
                  // a la vez, viajes compactados, todas con el mismo loc.id); si esta
                  // libre (sin servicio) usa loc.id, que ahi si es unico por chofer.
                  const markerId = loc.servicio?.id ?? `idle-${loc.id}`;
                  return (
                    <Marker
                      key={markerId}
                      position={{ lat: loc.lat, lng: loc.lng }}
                      onClick={() => setOpenInfoId(markerId)}
                      icon={
                        loc.servicio
                          ? undefined
                          : {
                              path: window.google.maps.SymbolPath.CIRCLE,
                              scale: 8,
                              fillColor: IDLE_DRIVER_COLOR,
                              fillOpacity: 0.9,
                              strokeColor: "#ffffff",
                              strokeWeight: 2,
                            }
                      }
                    >
                      {openInfoId === markerId && (
                        <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
                          <div className="text-[13px]">
                            <strong>
                              {loc.nombre} {loc.apellido}
                            </strong>
                            <br />
                            {loc.servicio ? (
                              <>
                                {loc.servicio.codigo} - {loc.servicio.destinazione}
                                <br />
                                Actualizado hace {minutesAgo(loc.actualizada)} min
                                <br />
                                {section !== "pendientes" ? null : openMarkerEta === undefined ? (
                                  "Calculando ETA en vivo..."
                                ) : openMarkerEta ? (
                                  <>
                                    <strong>En vivo:</strong> le faltan ~{Math.round(openMarkerEta.duracionMin)} min
                                    ({openMarkerEta.distanciaKm.toFixed(1)} km)
                                  </>
                                ) : (
                                  "ETA en vivo no disponible"
                                )}
                              </>
                            ) : (
                              <>
                                Sin servicio activo - disponible
                                <br />
                                Actualizado hace {minutesAgo(loc.actualizada)} min
                                <br />
                                {section !== "pendientes" ? null : openMarkerEta === undefined ? (
                                  "Calculando tiempo de regreso..."
                                ) : openMarkerEta ? (
                                  <>
                                    <strong>Volviendo a la base:</strong> ~{Math.round(openMarkerEta.duracionMin)}{" "}
                                    min ({openMarkerEta.distanciaKm.toFixed(1)} km)
                                  </>
                                ) : (
                                  "Tiempo de regreso no disponible"
                                )}
                              </>
                            )}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                  );
                })}

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
