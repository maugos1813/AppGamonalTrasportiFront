import { GoogleMap, InfoWindow, Marker, Polygon, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { EN_PROCESO_STATUSES } from "../../lib/constants";
import { computeLocationPermissionAlerts } from "../../lib/dashboardStats";
import { addMinutes, formatDateTime } from "../../lib/format";
import MILANO_ZONES from "../../lib/geo/milanoZones.json";
import { getRecordLiveEtaRequest, getRecordRequest, listRecordsRequest } from "../../lib/records.api";
import {
  getDriverRouteHistoryRequest,
  getDriverReturnEtaRequest,
  listDriverLocationsRequest,
  listUsersRequest,
} from "../../lib/users.api";

// Modulo estable fuera del componente: si se recrea en cada render, useJsApiLoader
// recarga el script de Google Maps una y otra vez.
const GOOGLE_MAPS_LIBRARIES = [];

const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };
const REFRESH_INTERVAL_MS = 20000;
const STATIC_ROUTE_COLOR = "#3987e5";
const LIVE_ROUTE_COLOR = "#22c55e";
const HISTORY_ROUTE_COLOR = "#a855f7";
const DESTINATION_COLOR = "#f59e0b";
const ROUTE_START_COLOR = "#22c55e";
const ROUTE_END_COLOR = "#ef4444";
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
  { value: "choferes", label: "Choferes" },
  { value: "ruta-chofer", label: "Ruta chofer" },
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
  // Segunda linea, independiente de la de arriba: el recorrido GPS real superpuesto a
  // la ruta planificada de un servicio de Pendientes (ver showRutaReal mas abajo) -
  // ref propio para poder mostrar las dos rutas a la vez sin que se pisen entre si.
  const overlayPolylineRef = useRef(null);
  const [openInfoId, setOpenInfoId] = useState(null);
  const [showAreaC, setShowAreaC] = useState(true);
  const [showAreaB, setShowAreaB] = useState(true);
  const [showRutaReal, setShowRutaReal] = useState(false);
  const [overlayGpsPoints, setOverlayGpsPoints] = useState(null);
  const [section, setSection] = useState("pendientes");

  const [locations, setLocations] = useState(null);
  const [records, setRecords] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  // "Ruta chofer": elige un chofer (todos, no solo los que estan compartiendo
  // ubicacion ahora) y un dia puntual, y dibuja los puntos GPS guardados ese dia
  // (ver LocationPing en el backend) como una linea - no depende de que el chofer
  // este activo ahora mismo, es historial.
  const [allDrivers, setAllDrivers] = useState(null);
  const [rutaChoferId, setRutaChoferId] = useState("");
  const [rutaChoferDate, setRutaChoferDate] = useState(() => toLocalDateInputValue(new Date()));
  const [rutaChoferPoints, setRutaChoferPoints] = useState(null);
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

  // Lista completa de choferes para el selector de "Ruta chofer" (a diferencia de
  // "locations", que solo trae a los que estan compartiendo ubicacion ahora mismo) -
  // se pide una sola vez, no hace falta refrescarla cada 20s.
  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;
    listUsersRequest()
      .then((data) => {
        if (!cancelled) setAllDrivers(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrivileged]);

  // Historial de puntos GPS del chofer/dia elegidos - se pide de nuevo cada vez que
  // cambia cualquiera de los dos, y solo mientras la seccion "Ruta chofer" esta activa.
  useEffect(() => {
    if (section !== "ruta-chofer" || !rutaChoferId || !rutaChoferDate) {
      setRutaChoferPoints(null);
      return;
    }
    let cancelled = false;
    setRutaChoferPoints(null);
    const [year, month, day] = rutaChoferDate.split("-").map(Number);
    getDriverRouteHistoryRequest(rutaChoferId, year, month, day)
      .then((data) => {
        if (!cancelled) setRutaChoferPoints(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(parseApiError(err).message);
          setRutaChoferPoints([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [section, rutaChoferId, rutaChoferDate]);

  // Solo ayer/hoy/manana (hora local de quien mira el mapa) - "records" trae todo el
  // historico sin acotar por fecha, y un servicio viejo que quedo pendiente sin
  // cerrarse (o uno cargado para dentro de varios dias) no tiene que ensuciar esta
  // lista, pensada para lo que hay que resolver ahora.
  const pendingDayKeys = useMemo(() => {
    const today = new Date();
    return new Set(
      [-1, 0, 1].map((offset) => {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        return toLocalDateInputValue(d);
      })
    );
  }, []);

  const pendingRecords = (records ?? [])
    .filter(
      (r) =>
        EN_PROCESO_STATUSES.includes(r.estado) &&
        pendingDayKeys.has(toLocalDateInputValue(new Date(r.fechaServicio)))
    )
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

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

  // Auditoria del mapa: choferes que no van a aparecer arriba (o que se van a "caer" del
  // mapa apenas salgan a repartir) porque el celular reporto el permiso de ubicacion en
  // segundo plano desactivado - la misma alerta que ya existe para la campanita/Resumen
  // diario, mostrada aca porque es exactamente donde importa notarla: junto a quienes SI
  // se estan viendo ahora mismo.
  const locationPermissionAlerts = useMemo(
    () => computeLocationPermissionAlerts(allDrivers ?? [], records ?? []),
    [allDrivers, records]
  );

  const focusDriver = (loc) => {
    const markerId = loc.servicio?.id ?? `idle-${loc.id}`;
    setOpenInfoId(markerId);
    map?.panTo({ lat: loc.lat, lng: loc.lng });
    map?.setZoom(15);
  };

  // ETA en vivo del servicio elegido en la lista: se pide solo mientras ese servicio
  // sigue seleccionado, y se repite cada 20s para mantenerlo al dia - apenas se cambia
  // de seleccion o de seccion, se corta (no sigue pidiendo de fondo).
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

  // Recorrido real (GPS) superpuesto al planificado, solo si el checkbox esta activo -
  // se pide para el chofer y el dia (fechaServicio) del servicio seleccionado, mismo
  // endpoint que ya usa "Ruta chofer" (findLocationPingsByDriverAndRange en el backend).
  // Se apaga (null) al destildar el checkbox, deseleccionar el servicio, o cambiar de
  // seccion - asi no queda una linea vieja dibujada de un servicio que ya no se mira.
  useEffect(() => {
    if (!showRutaReal || section !== "pendientes" || !selectedRecordDetail) {
      setOverlayGpsPoints(null);
      return;
    }

    let cancelled = false;
    setOverlayGpsPoints(null);
    const fecha = toLocalDateInputValue(new Date(selectedRecordDetail.fechaServicio));
    const [year, month, day] = fecha.split("-").map(Number);
    getDriverRouteHistoryRequest(selectedRecordDetail.driver.id, year, month, day)
      .then((data) => {
        if (!cancelled) setOverlayGpsPoints(data);
      })
      .catch(() => {
        if (!cancelled) setOverlayGpsPoints([]);
      });

    return () => {
      cancelled = true;
    };
  }, [showRutaReal, section, selectedRecordDetail]);

  // Solo "Pendientes" selecciona un registro (ver mas abajo): ETA en vivo si el chofer
  // ya esta en camino, si no el planificado como fallback mientras todavia no sale.
  const selectedRouteGeometry = selectedLiveEta?.geometria ?? selectedRecordDetail?.ruta?.geometria;
  const selectedRoutePositions = useMemo(
    () => selectedRouteGeometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })),
    [selectedRouteGeometry]
  );
  // Paradas del servicio seleccionado, ya en orden (ver RECORD_RELATIONS_SELECT en el
  // backend, orderBy orden asc) - se muestran todas con su letra (A, B, C...), no solo
  // la ultima, para poder seguir el recorrido parada por parada en el mapa.
  const selectedStops = selectedRecordDetail?.stops ?? [];

  // "Ruta chofer": los puntos GPS guardados ese dia, tal cual (no es una ruta
  // calculada/ruteada como la de un servicio, es el historial real punto a punto).
  const rutaChoferPositions = useMemo(
    () => rutaChoferPoints?.map((p) => ({ lat: p.lat, lng: p.lng })),
    [rutaChoferPoints]
  );

  // La linea que se dibuja depende de la seccion activa: el recorrido de un servicio
  // pendiente (Pendientes) o el historial de un chofer en un dia puntual (Ruta chofer).
  const activeRoutePositions = section === "ruta-chofer" ? rutaChoferPositions : selectedRoutePositions;
  const activeRouteColor =
    section === "ruta-chofer" ? HISTORY_ROUTE_COLOR : selectedLiveEta ? LIVE_ROUTE_COLOR : STATIC_ROUTE_COLOR;

  // Recorrido real (GPS) del servicio de Pendientes seleccionado, superpuesto a
  // activeRoutePositions (la ruta planificada/en vivo) - segunda linea independiente,
  // ver overlayPolylineRef mas abajo.
  const overlayGpsPositions = useMemo(
    () => (showRutaReal ? overlayGpsPoints?.map((p) => ({ lat: p.lat, lng: p.lng })) : null),
    [showRutaReal, overlayGpsPoints]
  );

  // Dibuja la ruta activa a mano (sin el componente <Polyline>): asi se controla
  // directo la instancia nativa de Google Maps y se garantiza que nunca haya 2 lineas
  // superpuestas. Antes de dibujar la nueva (o si no queda nada seleccionado), siempre
  // se borra la anterior primero - asi cumple la regla de "solo la linea actual, nunca
  // la anterior" al cambiar de seleccion, de seccion, o de ruta estatica a ETA en vivo.
  // @react-google-maps/api (el componente <Polyline> declarativo) no garantiza esto de
  // forma confiable al cambiar de instancia, sobre todo con StrictMode en desarrollo.
  useEffect(() => {
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!activeRoutePositions?.length) return;

    polylineRef.current = new window.google.maps.Polyline({
      path: activeRoutePositions,
      strokeColor: activeRouteColor,
      strokeWeight: 4,
      map,
    });

    return () => {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [map, activeRoutePositions, activeRouteColor]);

  // Segunda linea, en paralelo a la de arriba y sin tocarla: el recorrido GPS real
  // (overlayGpsPositions) al lado de la ruta planificada/en vivo, cuando "Recorrido
  // real (GPS)" esta activo. Mismo criterio de "borrar antes de redibujar".
  useEffect(() => {
    if (!map) return;

    if (overlayPolylineRef.current) {
      overlayPolylineRef.current.setMap(null);
      overlayPolylineRef.current = null;
    }

    if (!overlayGpsPositions?.length) return;

    overlayPolylineRef.current = new window.google.maps.Polyline({
      path: overlayGpsPositions,
      strokeColor: HISTORY_ROUTE_COLOR,
      strokeWeight: 4,
      map,
    });

    return () => {
      overlayPolylineRef.current?.setMap(null);
      overlayPolylineRef.current = null;
    };
  }, [map, overlayGpsPositions]);

  // Centra y ajusta el zoom del mapa para que la ruta activa (y el recorrido real
  // superpuesto, si esta activo) queden completamente visibles. Solo se reajusta al
  // cambiar de seleccion (o al cargar el overlay), no en cada refresco de datos, para
  // no pelearse con el pan/zoom manual del usuario mientras mira el mapa.
  useEffect(() => {
    if (!map || (!activeRoutePositions?.length && !overlayGpsPositions?.length)) return;
    const bounds = new window.google.maps.LatLngBounds();
    activeRoutePositions?.forEach((point) => bounds.extend(point));
    overlayGpsPositions?.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedRecordId, rutaChoferId, rutaChoferDate, overlayGpsPositions]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const showsDriverLocations = section === "pendientes" || section === "choferes";

  const center =
    section === "ruta-chofer" && rutaChoferPositions?.length
      ? rutaChoferPositions[0]
      : showsDriverLocations && locations && locations.length > 0
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
              : section === "ruta-chofer"
                ? "Recorrido real (GPS) de un chofer en un dia puntual."
                : "Ubicacion actual de todos los choferes, sin rutas ni ETA."}
          </p>
        </div>
        <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={changeSection} />
      </div>

      <Alert>{error || (loadError ? "No se pudo cargar Google Maps." : "")}</Alert>

      {/* Auditoria de GPS: estos choferes no van a aparecer en el mapa de arriba (o se
          van a "caer" apenas salgan a repartir) aunque tengan un servicio activo -
          visible aca sea cual sea la seccion elegida, no solo en "Pendientes"/"Choferes". */}
      {locationPermissionAlerts.length > 0 && (
        <GlassCard className="border border-status-rischedulato/25 bg-status-rischedulato/5 !p-4">
          <h2 className="text-[14px] font-semibold text-ink-50">
            GPS apagado ({locationPermissionAlerts.length})
          </h2>
          <p className="mt-1 text-[12px] text-ink-300">
            No van a aparecer arriba (o se van a caer apenas salgan a repartir) hasta que activen
            "Permitir todo el tiempo" en el celular.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {locationPermissionAlerts.map((alert) => (
              <li key={alert.id}>
                <Link
                  to={alert.link}
                  className={`block rounded-lg px-3 py-2 text-[12.5px] transition-colors hover:brightness-110 ${
                    alert.severity === "urgent"
                      ? "bg-danger-500/10 text-danger-500"
                      : "bg-status-rischedulato/10 text-status-rischedulato"
                  }`}
                >
                  {alert.message}
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

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
          ) : section === "ruta-chofer" ? (
            <>
              <h2 className="text-[17px] font-medium text-ink-50">Ruta chofer</h2>
              <p className="mt-1 text-[13px] text-ink-300">
                Elegi un chofer y un dia para ver su recorrido real (GPS), no el planificado.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line/10 pt-4">
                <Select
                  id="ruta-chofer-select"
                  label="Chofer"
                  options={[
                    { value: "", label: "Elegi un chofer..." },
                    ...(allDrivers ?? []).map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` })),
                  ]}
                  value={rutaChoferId}
                  onChange={(e) => setRutaChoferId(e.target.value)}
                />
                <TextField
                  id="ruta-chofer-fecha"
                  label="Fecha"
                  type="date"
                  value={rutaChoferDate}
                  onChange={(e) => setRutaChoferDate(e.target.value)}
                />
              </div>

              {!rutaChoferId && (
                <p className="mt-4 text-[14px] text-ink-300">Elegi un chofer para ver su recorrido.</p>
              )}
              {rutaChoferId && rutaChoferPoints === null && (
                <div className="mt-4 flex justify-center py-6">
                  <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                </div>
              )}
              {rutaChoferId && rutaChoferPoints?.length === 0 && (
                <p className="mt-4 text-[14px] text-ink-300">
                  No hay puntos GPS guardados para ese chofer ese dia.
                </p>
              )}
              {rutaChoferPoints?.length > 0 && (
                <div className="mt-4 rounded-xl glass-surface-sm px-4 py-3 text-[13px] text-ink-200">
                  <p>
                    <strong>{rutaChoferPoints.length}</strong> puntos registrados
                  </p>
                  <p className="mt-1 text-ink-300">Primero: {formatDateTime(rutaChoferPoints[0].recordedAt)}</p>
                  <p className="text-ink-300">
                    Ultimo: {formatDateTime(rutaChoferPoints[rutaChoferPoints.length - 1].recordedAt)}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-[17px] font-medium text-ink-50">Pronostico de llegada</h2>
              <p className="mt-1 text-[13px] text-ink-300">
                Servicios pendientes. Si el chofer ya esta en camino, se muestra el tiempo en vivo desde su
                ubicacion actual; si todavia no salio, se muestra el estimado planificado. Toca uno para ver
                la ruta en el mapa.
              </p>

          {pendingRecords.length === 0 && (
            <p className="mt-4 text-[14px] text-ink-300">No hay servicios pendientes.</p>
          )}

          <ul className="mt-4 flex flex-col gap-2">
            {pendingRecords.map((record) => {
              const isSelected = record.id === selectedRecordId;
              // El ETA en vivo solo se pidio para el servicio seleccionado (ver el
              // useEffect de mas arriba) - los demas siempre muestran el planificado.
              const liveEta = isSelected ? selectedLiveEta : undefined;
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
              {section === "pendientes" && selectedRecordId && (
                <label className="flex cursor-pointer items-center gap-2 border-t border-line/10 pt-1.5">
                  <input
                    type="checkbox"
                    checked={showRutaReal}
                    onChange={(e) => setShowRutaReal(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#a855f7]"
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: HISTORY_ROUTE_COLOR }}
                  />
                  Recorrido real (GPS)
                </label>
              )}
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

                {selectedStops.map((stop, i) => {
                  if (stop.lat == null || stop.lng == null) return null;
                  const markerId = `stop-${i}`;
                  const letter = String.fromCharCode(65 + i);
                  return (
                    <Marker
                      key={markerId}
                      position={{ lat: stop.lat, lng: stop.lng }}
                      onClick={() => setOpenInfoId(markerId)}
                      label={{ text: letter, color: "#ffffff", fontWeight: "700", fontSize: "12px" }}
                      icon={{
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: DESTINATION_COLOR,
                        fillOpacity: 0.9,
                        strokeColor: DESTINATION_COLOR,
                        strokeWeight: 1,
                      }}
                    >
                      {openInfoId === markerId && (
                        <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
                          <div className="text-[13px]">
                            Parada {letter}: {stop.direccion}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                  );
                })}

                {rutaChoferPositions?.length > 0 && (
                  <>
                    <Marker
                      position={rutaChoferPositions[0]}
                      onClick={() => setOpenInfoId("ruta-inicio")}
                      icon={{
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: ROUTE_START_COLOR,
                        fillOpacity: 0.9,
                        strokeColor: "#ffffff",
                        strokeWeight: 2,
                      }}
                    >
                      {openInfoId === "ruta-inicio" && (
                        <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
                          <div className="text-[13px]">
                            Inicio: {formatDateTime(rutaChoferPoints[0].recordedAt)}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                    <Marker
                      position={rutaChoferPositions[rutaChoferPositions.length - 1]}
                      onClick={() => setOpenInfoId("ruta-fin")}
                      icon={{
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: ROUTE_END_COLOR,
                        fillOpacity: 0.9,
                        strokeColor: "#ffffff",
                        strokeWeight: 2,
                      }}
                    >
                      {openInfoId === "ruta-fin" && (
                        <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
                          <div className="text-[13px]">
                            Ultimo punto: {formatDateTime(rutaChoferPoints[rutaChoferPoints.length - 1].recordedAt)}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                  </>
                )}
              </GoogleMap>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
