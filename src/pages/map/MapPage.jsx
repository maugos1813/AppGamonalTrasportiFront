import { GoogleMap, InfoWindow, Marker, Polygon, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { parseApiError } from "../../lib/api";
import { EN_PROCESO_STATUSES } from "../../lib/constants";
import { computeLocationPermissionAlerts, filterToPiazzaYDhlRoma } from "../../lib/dashboardStats";
import { addMinutes, formatDateTime } from "../../lib/format";
import MILANO_ZONES from "../../lib/geo/milanoZones.json";
import { startVisibleInterval } from "../../lib/polling";
import { getRecordLiveEtaRequest, listRecordsRequest } from "../../lib/records.api";
import {
  getEtaToDestinationRequest,
  listAreaCEntriesRequest,
  listVehicleLivePositionsRequest,
  updateAreaCEntryRequest,
} from "../../lib/vehicles.api";
import { getDriverReturnEtaRequest, listDriverLocationsRequest, listUsersRequest } from "../../lib/users.api";

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
// Chofer con ubicacion fresca pero sin servicio "en camino" ahora mismo (volviendo de
// una entrega o esperando el proximo): mismo gris que el estado "En suspenso" en el
// resto de la app, para diferenciarlo del pin rojo por defecto de los que si reparten.
const IDLE_DRIVER_COLOR = "#6b7280";
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

// Ruta y pin del destino escrito a mano (buscador de targa, "ETA a un destino") -
// mismo azul que el resto de la app para lineas de ruta, para no sumar otro color mas.
const DESTINO_ROUTE_COLOR = "#3987e5";

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

// Una fila por entrada al Area C (targa + hora, ya completados) - el checkbox y el
// comprobante son ediciones locales hasta que se confirman con "Guardar" (un solo
// PATCH con los dos juntos, no uno por cada cambio - ver updateAreaCEntryRequest).
const AreaCEntryRow = ({ entry, onSaved }) => {
  const [pagado, setPagado] = useState(entry.pagado);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = pagado !== entry.pagado || file != null;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const formData = new FormData();
    formData.append("pagado", pagado);
    if (file) formData.append("comprobante", file);

    try {
      const updated = await updateAreaCEntryRequest(entry.id, formData);
      onSaved(updated);
      setFile(null);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-xl glass-surface-sm px-4 py-3 text-[13px] text-ink-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink-50">{entry.targa}</span>
        <span className="text-ink-400">{formatDateTime(entry.enteredAt)}</span>
      </div>

      {entry.comprobanteUrl && (
        <a
          href={entry.comprobanteUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-[12px] text-accent-400 hover:underline"
        >
          Ver comprobante
        </a>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={pagado}
            onChange={(e) => setPagado(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          Pagado
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-ink-300">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="rounded-lg glass-input px-2.5 py-1 text-[12px]">
            {file?.name ?? (entry.comprobanteUrl ? "Reemplazar comprobante" : "Subir comprobante")}
          </span>
        </label>
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent-500 px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        )}
      </div>

      {error && <p className="mt-1.5 text-[12px] text-danger-500">{error}</p>}
    </li>
  );
};

export const MapPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  // Instancia nativa del mapa (ver onLoad/onUnmount mas abajo) - hace falta para
  // centrar/hacer zoom al elegir un resultado del buscador de targa.
  const [map, setMap] = useState(null);
  const [openInfoId, setOpenInfoId] = useState(null);
  const [showAreaC, setShowAreaC] = useState(true);
  const [showAreaB, setShowAreaB] = useState(true);
  // Buscador de targa (o nombre de chofer) de la parte superior - ver targaMatches
  // mas abajo. searchFocused controla si se muestra el desplegable de resultados.
  const [targaQuery, setTargaQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // ETA a un destino escrito a mano, para el marcador que tiene el InfoWindow abierto
  // (ver el formulario adentro del InfoWindow mas abajo). undefined = todavia no se
  // busco nada, null = se busco pero no se pudo calcular.
  const [destinoQuery, setDestinoQuery] = useState("");
  const [destinoEta, setDestinoEta] = useState(undefined);
  const [destinoLoading, setDestinoLoading] = useState(false);

  const [locations, setLocations] = useState(null);
  // GPS del vehiculo (Velocity Fleet) - solo trae los vehiculos que tienen el
  // dispositivo instalado. Ver enrichedLocations mas abajo: reemplaza la posicion del
  // celular del chofer por esta cuando esta disponible para su vehiculo asignado.
  const [vehiclePositions, setVehiclePositions] = useState(null);
  const [records, setRecords] = useState(null);
  const [allDrivers, setAllDrivers] = useState(null);
  // Seccion "Area C" del Mapa (pestanias Pagado/No pagado) - ver AreaCEntryRow.
  const [areaCEntries, setAreaCEntries] = useState(null);
  const [areaCTab, setAreaCTab] = useState("no-pagado");
  // ETA del marcador que tiene el InfoWindow abierto en el mapa (un servicio en camino,
  // o el regreso de un chofer libre) - se pide a demanda (ver el useEffect mas abajo),
  // no para todos los choferes en cada refresco de posiciones: recalcular la ruta de 30
  // choferes cada 30s aunque nadie los este mirando sale caro de mas.
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
      listAreaCEntriesRequest()
        .then((data) => {
          if (!cancelled) setAreaCEntries(data);
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

  // Lista completa de choferes (a diferencia de "locations", que solo trae a los que
  // estan compartiendo ubicacion ahora mismo) - para cruzar el vehiculo asignado de
  // cada uno con el GPS de Velocity Fleet (ver driverVehicleTarga/enrichedLocations mas
  // abajo) y para la auditoria de permisos de GPS. Se pide una sola vez, no hace falta
  // refrescarla cada 30s.
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

  // Resultados del buscador de targa/chofer de la parte superior - matchea contra la
  // targa (sin espacios, sin importar mayus/minus) o el nombre del chofer. Vacio si
  // todavia no se escribio nada, para no mostrar el desplegable sin necesidad.
  const targaMatches = useMemo(() => {
    const query = targaQuery.trim();
    if (!query) return [];
    const normQuery = normalizeTarga(query);
    const lowerQuery = query.toLowerCase();
    return (enrichedLocations ?? [])
      .filter((loc) => {
        const targa = loc.vehiculoGps?.targa;
        const matchesTarga = targa && normalizeTarga(targa).includes(normQuery);
        const matchesNombre = `${loc.nombre} ${loc.apellido}`.toLowerCase().includes(lowerQuery);
        return matchesTarga || matchesNombre;
      })
      .slice(0, 8);
  }, [targaQuery, enrichedLocations]);

  // Centra/hace zoom sobre el resultado elegido y abre su InfoWindow - mismo id que
  // usan los Marker mas abajo (loc.servicio?.id ?? `idle-${loc.id}`).
  const selectTargaMatch = (loc) => {
    const markerId = loc.servicio?.id ?? `idle-${loc.id}`;
    setOpenInfoId(markerId);
    map?.panTo({ lat: loc.lat, lng: loc.lng });
    map?.setZoom(15);
    setTargaQuery("");
    setSearchFocused(false);
  };

  // Auditoria del mapa: choferes que no van a aparecer arriba (o que se van a "caer" del
  // mapa apenas salgan a repartir) porque el celular reporto el permiso de ubicacion en
  // segundo plano desactivado - la misma alerta que ya existe para la campanita/Resumen
  // diario, mostrada aca porque es exactamente donde importa notarla: junto a quienes SI
  // se estan viendo ahora mismo.
  const locationPermissionAlerts = useMemo(
    () => computeLocationPermissionAlerts(allDrivers ?? [], records ?? []),
    [allDrivers, records]
  );

  const unpaidAreaCEntries = (areaCEntries ?? []).filter((e) => !e.pagado);
  const paidAreaCEntries = (areaCEntries ?? []).filter((e) => e.pagado);
  const visibleAreaCEntries = areaCTab === "no-pagado" ? unpaidAreaCEntries : paidAreaCEntries;

  const handleAreaCEntrySaved = (updated) => {
    setAreaCEntries((prev) => (prev ?? []).map((e) => (e.id === updated.id ? updated : e)));
  };

  // ETA del marcador que tiene el InfoWindow abierto en el mapa (puede
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

  // Vehiculo/chofer del marcador que tiene el InfoWindow abierto ahora mismo (o
  // undefined si no hay ninguno abierto) - se usa para el formulario de "ETA a un
  // destino" que se muestra adentro del InfoWindow.
  const openLoc = useMemo(
    () => enrichedLocations?.find((loc) => (loc.servicio?.id ?? `idle-${loc.id}`) === openInfoId),
    [enrichedLocations, openInfoId]
  );

  // El formulario de destino es "a demanda" (el usuario escribe y confirma), no se
  // vuelve a pedir solo. Se limpia al cambiar de marcador (o cerrar el InfoWindow)
  // para no mostrar el resultado de un vehiculo distinto al que se esta mirando ahora.
  useEffect(() => {
    setDestinoQuery("");
    setDestinoEta(undefined);
    setDestinoLoading(false);
  }, [openInfoId]);

  const submitDestinoSearch = (e) => {
    e.preventDefault();
    const destino = destinoQuery.trim();
    if (!destino || !openLoc) return;
    setDestinoLoading(true);
    getEtaToDestinationRequest(openLoc.lat, openLoc.lng, destino)
      .then((eta) => setDestinoEta(eta ?? null))
      .catch(() => setDestinoEta(null))
      .finally(() => setDestinoLoading(false));
  };

  // Geometria de la ruta al destino escrito a mano (ver DESTINO_ROUTE_COLOR mas
  // abajo, se dibuja con <Polyline>) - viene directo en la respuesta del backend
  // (OSRM ya la calcula junto con distancia/duracion), no es una consulta extra.
  const destinoRoutePositions = useMemo(
    () => destinoEta?.geometria?.coordinates?.map(([lng, lat]) => ({ lat, lng })),
    [destinoEta]
  );

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
          <p className="mt-1 text-[14px] text-ink-300">Choferes y vehiculos con ubicacion en vivo.</p>
        </div>

        {/* Buscador de targa/chofer: filtra sobre lo que ya esta en pantalla
            (enrichedLocations), sin pedir nada al backend. El desplegable se cierra
            solo al elegir un resultado o al perder el foco (con un delay chico para
            que el click en un resultado registre antes de que el blur lo cierre). */}
        <div className="relative w-full sm:w-72">
          <TextField
            id="mapa-buscar-targa"
            placeholder="Buscar por targa o chofer..."
            value={targaQuery}
            onChange={(e) => setTargaQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && targaMatches[0]) selectTargaMatch(targaMatches[0]);
            }}
          />
          {searchFocused && targaQuery.trim() && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-xl glass-surface-sm p-1.5">
              {targaMatches.length === 0 ? (
                <li className="px-3 py-2 text-[13px] text-ink-300">Sin resultados.</li>
              ) : (
                targaMatches.map((loc) => (
                  <li key={loc.id}>
                    <button
                      type="button"
                      // onMouseDown (no onClick): dispara antes del blur del input, asi
                      // el setTimeout de arriba no llega a cerrar el desplegable antes.
                      onMouseDown={() => selectTargaMatch(loc)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-[13px] text-ink-200 transition-colors hover:bg-line/10"
                    >
                      <span className="font-medium text-ink-50">
                        {loc.vehiculoGps?.targa ?? "Sin GPS de vehiculo"}
                      </span>
                      <span className="text-ink-300">
                        {loc.sinChofer ? "Sin chofer asignado" : `${loc.nombre} ${loc.apellido}`}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
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

      {/* Vehiculos sin autorizadoAreaC detectados dentro del Area C (se registran
          solos, ver checkAreaCEntries en el backend) - targa y hora ya completados, el
          checkbox de "Pagado" y la foto del comprobante se cargan a mano aca.
          Siempre visible (aunque este vacia): asi se distingue "no hay nada todavia"
          de "esto esta roto", en vez de que la seccion entera desaparezca sin mas. */}
      <GlassCard className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-ink-50">Area C</h2>
          <SegmentedControl
            options={[
              { value: "no-pagado", label: `No pagado (${unpaidAreaCEntries.length})` },
              { value: "pagado", label: `Pagado (${paidAreaCEntries.length})` },
            ]}
            value={areaCTab}
            onChange={setAreaCTab}
          />
        </div>

        {visibleAreaCEntries.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-300">
            {areaCTab === "no-pagado" ? "Nada pendiente de pagar." : "Todavia no hay ninguna pagada."}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {visibleAreaCEntries.map((entry) => (
              <AreaCEntryRow key={entry.id} entry={entry} onSaved={handleAreaCEntrySaved} />
            ))}
          </ul>
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

              {destinoRoutePositions?.length > 0 && (
                <>
                  <Polyline
                    path={destinoRoutePositions}
                    options={{ strokeColor: DESTINO_ROUTE_COLOR, strokeWeight: 4 }}
                  />
                  <Marker
                    position={destinoEta.destino}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 9,
                      fillColor: DESTINO_ROUTE_COLOR,
                      fillOpacity: 0.9,
                      strokeColor: "#ffffff",
                      strokeWeight: 2,
                    }}
                  />
                </>
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

                          {/* ETA a un destino escrito a mano: cuanto tardaria este
                              vehiculo/chofer si saliera ahora hacia ahi. Colores fijos,
                              sin clases de tema (ink, dark): la burbuja de Google
                              siempre es clara, ver el override de .gm-style-iw en
                              index.css. */}
                          <form
                            onSubmit={submitDestinoSearch}
                            className="mt-2 flex gap-1.5 border-t border-gray-200 pt-2"
                          >
                            <input
                              type="text"
                              value={destinoQuery}
                              onChange={(e) => setDestinoQuery(e.target.value)}
                              placeholder="A donde llegaria (direccion o ciudad)..."
                              className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-[12px] text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={destinoLoading || !destinoQuery.trim()}
                              className="shrink-0 rounded-md bg-gray-900 px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
                            >
                              ETA
                            </button>
                          </form>
                          {destinoLoading && (
                            <p className="mt-1.5 text-[12px] text-gray-500">Calculando...</p>
                          )}
                          {!destinoLoading && destinoEta === null && (
                            <p className="mt-1.5 text-[12px] text-gray-500">
                              No se pudo calcular la ruta a ese destino.
                            </p>
                          )}
                          {!destinoLoading && destinoEta && (
                            <p className="mt-1.5 text-[12px] text-gray-700">
                              {destinoEta.distanciaKm.toFixed(1)} km - {Math.round(destinoEta.duracionMin)} min -
                              llegaria aprox a las {addMinutes(new Date(), destinoEta.duracionMin)}
                            </p>
                          )}
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
  );
};
