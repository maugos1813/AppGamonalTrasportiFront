import { GoogleMap, InfoWindow, Marker, Polygon, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { parseApiError } from "../../lib/api";
import { EN_PROCESO_STATUSES } from "../../lib/constants";
import { computeLocationPermissionAlerts, filterToPiazzaYDhlRoma } from "../../lib/dashboardStats";
import { addMinutes } from "../../lib/format";
import MILANO_ZONES from "../../lib/geo/milanoZones.json";
import { startVisibleInterval } from "../../lib/polling";
import { getRecordLiveEtaRequest, getRecordRequest, listRecordsRequest } from "../../lib/records.api";
import { listVehicleLivePositionsRequest } from "../../lib/vehicles.api";
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
// 30s: coincide con lo que la propia Velocity Fleet recomienda como cadencia para el
// GPS del vehiculo (ver KINESIS_LIVE_MAP_REFRESH_RATE en su doc de Device Positions) -
// llamar mas seguido que eso no aporta nada, solo consume mas cuota de su API. Se
// aplica igual a ubicaciones/registros/ETA para no tener 2 cadencias distintas en la
// misma pagina.
const REFRESH_INTERVAL_MS = 30000;

// Estilo "Night Mode" estandar de Google Maps - se aplica solo cuando el tema de la
// app esta en oscuro (ver useTheme), asi el mapa combina con el resto de la UI en vez
// de quedar siempre con el fondo claro de Google por defecto.
const NIGHT_MODE_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];
const STATIC_ROUTE_COLOR = "#3987e5";
const LIVE_ROUTE_COLOR = "#22c55e";
const HISTORY_ROUTE_COLOR = "#a855f7";
const DESTINATION_COLOR = "#f59e0b";
// Chofer con ubicacion fresca pero sin servicio "en camino" ahora mismo (volviendo de
// una entrega o esperando el proximo): mismo gris que el estado "En suspenso" en el
// resto de la app, para diferenciarlo del pin rojo por defecto de los que si reparten.
const IDLE_DRIVER_COLOR = "#6b7280";
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

// Colores del pin para un vehiculo con GPS de Velocity Fleet, segun movimiento/motor -
// pedido explicito: verde en movimiento, naranja parado con motor encendido, rojo
// parado y apagado. Umbral chico (no exactamente 0) para no marcar "en movimiento" un
// vehiculo parado por el ruido normal de un GPS quieto.
const VEHICLE_MOVING_SPEED_THRESHOLD = 1;
const VEHICLE_STATUS_COLOR = {
  moving: "#22c55e",
  idlingOn: "#f59e0b",
  idlingOff: "#ef4444",
};
const isVehicleMoving = (vehiculoGps) =>
  vehiculoGps.speed != null && vehiculoGps.speed > VEHICLE_MOVING_SPEED_THRESHOLD;

const vehicleStatusColor = (vehiculoGps) => {
  if (isVehicleMoving(vehiculoGps)) return VEHICLE_STATUS_COLOR.moving;
  return vehiculoGps.ignition ? VEHICLE_STATUS_COLOR.idlingOn : VEHICLE_STATUS_COLOR.idlingOff;
};

// En movimiento y con rumbo (direction) conocido: flecha rotada senalando hacia donde
// va, mas realista que un circulo. Parado, o en movimiento sin rumbo (direction viene
// null en algunos dispositivos), se mantiene el circulo de siempre.
const vehicleIcon = (vehiculoGps) => {
  const moving = isVehicleMoving(vehiculoGps);
  if (moving && vehiculoGps.direction != null) {
    return {
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 5,
      rotation: vehiculoGps.direction,
      fillColor: VEHICLE_STATUS_COLOR.moving,
      fillOpacity: 0.9,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    };
  }
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: vehicleStatusColor(vehiculoGps),
    fillOpacity: 0.9,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
};

// Perimetros oficiales de Area B y Area C (Comune di Milano, portal GIS
// gisportal.comune.milano.it - capas "Confine Area B" y "Confine Area C").
// Area B viene como MultiPolygon (el contorno grande mas varios enclaves chicos
// separados), por eso son varios "paths" en el mismo Polygon.
const AREA_C_COLOR = "#ef4444";
const AREA_B_COLOR = "#a855f7";
const AREA_C_PATH = MILANO_ZONES.areaC;
const AREA_B_PATHS = MILANO_ZONES.areaB;

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
  const { theme } = useTheme();
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

  const [locations, setLocations] = useState(null);
  // GPS del vehiculo (Velocity Fleet) - solo trae los vehiculos que tienen el
  // dispositivo instalado. Ver enrichedLocations mas abajo: reemplaza la posicion del
  // celular del chofer por esta cuando esta disponible para su vehiculo asignado.
  const [vehiclePositions, setVehiclePositions] = useState(null);
  const [records, setRecords] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [allDrivers, setAllDrivers] = useState(null);
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
          // Acotado a Piazza + DHL Roma (ver filterToPiazzaYDhlRoma) - la lista de
          // "servicios en curso" no debe mostrar pendientes de DHL Milano/AB Service/
          // Extras Stefania, mismo criterio que el resto de la app.
          if (!cancelled) setRecords(filterToPiazzaYDhlRoma(data));
        })
        .catch((err) => {
          if (!cancelled) setError(parseApiError(err).message);
        });
      // Silencioso: el backend ya devuelve [] si Velocity Fleet no esta configurado o
      // no responde (ver velocityFleet.service.js) - no tiene sentido mostrar el error
      // banner de la pagina por una mejora best-effort, el mapa sigue andando igual con
      // la ubicacion del celular del chofer.
      listVehicleLivePositionsRequest()
        .then((data) => {
          if (!cancelled) setVehiclePositions(data);
        })
        .catch(() => {});
    };

    load();
    // Pausa sola mientras la pestania no esta visible (ver startVisibleInterval) - una
    // pestania del Mapa olvidada en segundo plano no tiene por que seguir pidiendo
    // ubicaciones/registros cada 20s para siempre.
    const stopPolling = startVisibleInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      stopPolling();
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

  const normalizeTarga = (targa) => targa?.replace(/\s+/g, "").toUpperCase() ?? "";

  // Vehiculo asignado (targa) de cada chofer, para cruzar con vehiclePositions -
  // viene de allDrivers (lista completa), no de "locations", que no trae ese dato.
  const driverVehicleTarga = useMemo(() => {
    const map = new Map();
    (allDrivers ?? []).forEach((d) => {
      if (d.vehiculoAsignado?.targa) map.set(d.id, d.vehiculoAsignado.targa);
    });
    return map;
  }, [allDrivers]);

  const vehiclePositionByTarga = useMemo(() => {
    const map = new Map();
    (vehiclePositions ?? []).forEach((p) => map.set(normalizeTarga(p.targa), p));
    return map;
  }, [vehiclePositions]);

  // Reemplaza la posicion del celular del chofer por la del GPS de su vehiculo
  // asignado (Velocity Fleet) cuando esa unidad lo tiene instalado - pedido
  // explicito: mas preciso, viene del vehiculo y no del telefono. Los vehiculos sin
  // ese GPS (no todos lo tienen todavia) siguen mostrando la ubicacion del celular,
  // sin excepcion - nunca se cae el pin por no tener el dispositivo instalado.
  //
  // Ademas: un vehiculo con GPS de Velocity Fleet tiene que aparecer aunque el
  // celular del chofer NO este compartiendo ubicacion en este momento (celular
  // apagado, permiso denegado, o simplemente todavia no arranco a compartir) - sin
  // esto, un vehiculo con GPS real quedaba sin pin solo porque no habia una entrada
  // de "locations" (celular) previa a la cual reemplazarle la posicion.
  const enrichedLocations = useMemo(() => {
    if (!locations) return locations;

    const driverIdsWithPhoneLocation = new Set(locations.map((loc) => loc.id));
    // Targas ya usadas (por un chofer con celular o sin el, mas abajo) - lo que quede
    // sin marcar al final son vehiculos con GPS que hoy no tienen a nadie asignado,
    // y aun asi tienen que verse: el pedido es ver los vehiculos, no solo los que
    // tienen chofer puesto en este momento.
    const usedTargas = new Set();

    const merged = locations.map((loc) => {
      const targa = driverVehicleTarga.get(loc.id);
      const normTarga = targa ? normalizeTarga(targa) : null;
      const vehiclePosition = normTarga ? vehiclePositionByTarga.get(normTarga) : undefined;
      if (!vehiclePosition) return loc;
      usedTargas.add(normTarga);
      return {
        ...loc,
        lat: vehiclePosition.lat,
        lng: vehiclePosition.lng,
        actualizada: vehiclePosition.updatedAt ?? loc.actualizada,
        vehiculoGps: {
          targa,
          speed: vehiclePosition.speed,
          speedUnit: vehiclePosition.speedUnit,
          ignition: vehiclePosition.ignition,
          direction: vehiclePosition.direction,
        },
      };
    });

    (allDrivers ?? []).forEach((d) => {
      if (driverIdsWithPhoneLocation.has(d.id)) return; // ya cubierto arriba
      const targa = d.vehiculoAsignado?.targa;
      const normTarga = targa ? normalizeTarga(targa) : null;
      if (!normTarga || usedTargas.has(normTarga)) return;
      const vehiclePosition = vehiclePositionByTarga.get(normTarga);
      if (!vehiclePosition) return;
      usedTargas.add(normTarga);

      // El servicio activo del chofer (si tiene) no viene con el GPS del vehiculo -
      // se busca en "records" para que el pin/lista se comporten igual que uno con
      // ubicacion de celular (icono, aparecer en Pendientes, etc.).
      const servicio =
        (records ?? []).find((r) => r.driver?.id === d.id && EN_PROCESO_STATUSES.includes(r.estado)) ?? null;

      merged.push({
        id: d.id,
        nombre: d.nombre,
        apellido: d.apellido,
        lat: vehiclePosition.lat,
        lng: vehiclePosition.lng,
        actualizada: vehiclePosition.updatedAt,
        servicio,
        vehiculoGps: {
          targa,
          speed: vehiclePosition.speed,
          speedUnit: vehiclePosition.speedUnit,
          ignition: vehiclePosition.ignition,
          direction: vehiclePosition.direction,
        },
      });
    });

    // Vehiculos con GPS que no tienen chofer asignado ahora mismo (o cuyo chofer
    // asignado no matcheo arriba por algun motivo) - se muestran igual, solo con la
    // targa como "nombre" (no hay chofer que mostrar).
    (vehiclePositions ?? []).forEach((vp) => {
      const normTarga = normalizeTarga(vp.targa);
      if (usedTargas.has(normTarga)) return;
      usedTargas.add(normTarga);

      merged.push({
        id: `vehiculo-${normTarga}`,
        nombre: vp.targa,
        apellido: "",
        lat: vp.lat,
        lng: vp.lng,
        actualizada: vp.updatedAt,
        servicio: null,
        vehiculoGps: {
          targa: vp.targa,
          speed: vp.speed,
          speedUnit: vp.speedUnit,
          ignition: vp.ignition,
          direction: vp.direction,
        },
        sinChofer: true,
      });
    });

    return merged;
  }, [locations, allDrivers, records, vehiclePositions, driverVehicleTarga, vehiclePositionByTarga]);

  // Auditoria del mapa: choferes que no van a aparecer arriba (o que se van a "caer" del
  // mapa apenas salgan a repartir) porque el celular reporto el permiso de ubicacion en
  // segundo plano desactivado - la misma alerta que ya existe para la campanita/Resumen
  // diario, mostrada aca porque es exactamente donde importa notarla: junto a quienes SI
  // se estan viendo ahora mismo.
  const locationPermissionAlerts = useMemo(
    () => computeLocationPermissionAlerts(allDrivers ?? [], records ?? []),
    [allDrivers, records]
  );

  // ETA en vivo del servicio elegido en la lista: se pide solo mientras ese servicio
  // sigue seleccionado, y se repite cada 20s para mantenerlo al dia - apenas se cambia
  // de seleccion, se corta (no sigue pidiendo de fondo).
  useEffect(() => {
    if (!selectedRecordId) {
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
    const stopPolling = startVisibleInterval(fetchEta, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [selectedRecordId]);

  // Mismo patron para el marcador que tiene el InfoWindow abierto en el mapa (puede
  // ser un servicio en camino o un chofer libre volviendo a la base) - solo se pide
  // mientras ese InfoWindow sigue abierto. undefined = todavia no llego la primera
  // respuesta ("Calculando..."), null = ya se pidio pero no hay ETA disponible.
  useEffect(() => {
    if (!openInfoId || openInfoId === "destination") {
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
    const stopPolling = startVisibleInterval(fetchEta, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [openInfoId]);

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
  // se pide para el chofer y el dia (fechaServicio) del servicio seleccionado
  // (findLocationPingsByDriverAndRange en el backend). Se apaga (null) al destildar el
  // checkbox o deseleccionar el servicio - asi no queda una linea vieja dibujada de un
  // servicio que ya no se mira.
  useEffect(() => {
    if (!showRutaReal || !selectedRecordDetail) {
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
  }, [showRutaReal, selectedRecordDetail]);

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

  // La linea que se dibuja es siempre el recorrido del servicio pendiente seleccionado
  // (planificado, o en vivo si el chofer ya salio).
  const activeRoutePositions = selectedRoutePositions;
  const activeRouteColor = selectedLiveEta ? LIVE_ROUTE_COLOR : STATIC_ROUTE_COLOR;

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
  }, [map, selectedRecordId, overlayGpsPositions]);

  // Centra el mapa en el primer chofer/vehiculo con ubicacion, pero UNA sola vez (la
  // primera vez que hay datos) - antes se recalculaba en cada refresco de
  // "locations"/"vehiclePositions" (cada 20s), y GoogleMap volvia a centrar el mapa
  // ahi solo -en Roma, si el primero de la lista quedaba ahi- peleandose con que el
  // usuario estuviera explorando otra parte del mapa a mano. Pedido explicito: no
  // reiniciar mas la vista sola.
  const hasAutoCenteredOnDriversRef = useRef(false);
  const [driversAutoCenter, setDriversAutoCenter] = useState(null);
  useEffect(() => {
    if (hasAutoCenteredOnDriversRef.current) return;
    if (!enrichedLocations?.length) return;
    setDriversAutoCenter({ lat: enrichedLocations[0].lat, lng: enrichedLocations[0].lng });
    hasAutoCenteredOnDriversRef.current = true;
  }, [enrichedLocations]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const center = driversAutoCenter ?? MILAN_CENTER;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Mapa</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            Choferes y vehiculos con ubicacion en vivo, mas los servicios pendientes.
          </p>
        </div>
      </div>

      {/* Solo tiene sentido si hay al menos un vehiculo con GPS de Velocity Fleet en
          pantalla - sin eso, ningun pin usa estos colores todavia. */}
      {enrichedLocations?.some((loc) => loc.vehiculoGps) && (
        <div className="flex flex-wrap items-center gap-4 text-[12px] text-ink-300">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: VEHICLE_STATUS_COLOR.moving }}
            />
            En movimiento
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: VEHICLE_STATUS_COLOR.idlingOn }}
            />
            Parado, motor encendido
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: VEHICLE_STATUS_COLOR.idlingOff }}
            />
            Parado, motor apagado
          </span>
        </div>
      )}

      <Alert>{error || (loadError ? "No se pudo cargar Google Maps." : "")}</Alert>

      {/* Auditoria de GPS: estos choferes no van a aparecer en el mapa de arriba (o se
          van a "caer" apenas salgan a repartir) aunque tengan un servicio activo. */}
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

      {/* En desktop (lg+) queda lista a la izquierda y mapa a la derecha, a la
          espera de que se elija un servicio pendiente; en mobile se apilan
          (lista primero, despues el mapa). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:items-start">
        <GlassCard className="lg:h-[calc(100dvh-220px)] lg:overflow-y-auto">
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
              {selectedRecordId && (
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
              <div className="flex items-center gap-2 border-t border-line/10 pt-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: IDLE_DRIVER_COLOR }}
                />
                Chofer disponible
              </div>
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
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  styles: theme === "dark" ? NIGHT_MODE_STYLES : undefined,
                }}
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

                {enrichedLocations?.map((loc) => {
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
                        loc.vehiculoGps
                          ? vehicleIcon(loc.vehiculoGps)
                          : loc.servicio
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
                            {loc.vehiculoGps && (
                              <>
                                GPS del vehiculo {loc.vehiculoGps.targa}
                                {loc.vehiculoGps.speed != null
                                  ? ` - ${Math.round(loc.vehiculoGps.speed)} ${loc.vehiculoGps.speedUnit ?? ""}`
                                  : ""}
                                {loc.vehiculoGps.ignition === false ? " (motor apagado)" : ""}
                                <br />
                              </>
                            )}
                            {loc.servicio ? (
                              <>
                                {loc.servicio.codigo} - {loc.servicio.destinazione}
                                <br />
                                Actualizado hace {minutesAgo(loc.actualizada)} min
                                <br />
                                {openMarkerEta === undefined ? (
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
                            ) : loc.sinChofer ? (
                              <>
                                Sin chofer asignado
                                <br />
                                Actualizado hace {minutesAgo(loc.actualizada)} min
                              </>
                            ) : (
                              <>
                                Sin servicio activo - disponible
                                <br />
                                Actualizado hace {minutesAgo(loc.actualizada)} min
                                <br />
                                {openMarkerEta === undefined ? (
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
              </GoogleMap>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
