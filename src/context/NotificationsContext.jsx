import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  computeAppsheetSyncAlerts,
  computeBirthdayAlerts,
  computeCurrentService,
  computeDriverDocumentAlerts,
  computeLocationPermissionAlerts,
  computeOverdueServices,
  computeVehicleDocumentAlerts,
  computeVehicleMaintenanceAlerts,
  getVehicleMaintenanceAlert,
} from "../lib/dashboardStats";
import { listDocumentsRequest } from "../lib/documents.api";
import { formatDate } from "../lib/format";
import {
  listAppsheetSyncFailuresRequest,
  listPendingRecordsRequest,
  listRecordFilesRequest,
  listRecordsRequest,
} from "../lib/records.api";
import { listUsersRequest } from "../lib/users.api";
import { getVehicleRequest, listVehiclesRequest } from "../lib/vehicles.api";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
// Las alertas OWNER/ADMIN dependen de tiempos concretos (ETA a 45min, vencimientos
// a 30 dias): se refrescan solas cada minuto para no depender de que el usuario navegue.
const OWNER_REFRESH_MS = 60 * 1000;

const SEVERITY_ORDER = { urgent: 0, warning: 1, reminder: 2 };
const sortBySeverity = (list) =>
  [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

// Alertas operativas del chofer (vencimientos, mantenimiento del vehiculo asignado,
// evidencia faltante).
const buildChoferAlerts = async () => {
  const records = await listRecordsRequest();
  const list = [];

  computeOverdueServices(records).forEach((record) => {
    list.push({
      id: `overdue-${record.id}`,
      severity: "warning",
      message: `Servicio ${record.codigo} sigue abierto y ya paso su fecha de servicio (${formatDate(record.fechaServicio)}).`,
    });
  });

  const current = computeCurrentService(records);
  if (current?.vehicle?.id) {
    try {
      const vehicle = await getVehicleRequest(current.vehicle.id);
      if (vehicle.estado === "EN_MANTENIMIENTO") {
        list.push({
          id: `maintenance-${vehicle.id}`,
          severity: "warning",
          message: `El vehiculo asignado (${vehicle.targa}) esta en mantenimiento.`,
        });
      }

      const tagliandoAlert = getVehicleMaintenanceAlert(vehicle, { withLink: false });
      if (tagliandoAlert) list.push(tagliandoAlert);
    } catch {
      // si falla la consulta del vehiculo, no bloquea el resto de las alertas
    }
  }

  const now = Date.now();
  const recentDelivered = records.filter(
    (r) => r.estado === "CONSEGNATO" && now - new Date(r.fechaServicio).getTime() <= FOURTEEN_DAYS_MS
  );

  const filesByRecord = await Promise.all(
    recentDelivered.map((r) => listRecordFilesRequest(r.id).catch(() => []))
  );

  recentDelivered.forEach((record, idx) => {
    const hasEvidence = filesByRecord[idx].some((f) => f.tipoArchivo === "FOTO_ENTREGA");
    if (!hasEvidence) {
      list.push({
        id: `evidence-${record.id}`,
        severity: "warning",
        message: `Falta subir la foto de entrega del servicio ${record.codigo}.`,
      });
    }
  });

  return list;
};

// Notificaciones OWNER/ADMIN: documentos de choferes y vehiculos por vencer, y
// cumpleanios proximos. Los servicios por vencer (ETA) ya NO estan aca: el panel de
// Pendientes de Registros los cubre mejor (con colores de urgencia), y traer el
// historico completo de registros solo para esa alerta hacia que las notificaciones
// tardaran en cargar. computeLocationPermissionAlerts solo necesita saber que chofer
// esta "en camino" ahora mismo, asi que le alcanza con los pendientes de hoy.
const buildOwnerAlerts = async () => {
  const [pendingRecords, users, vehicles, documents, syncFailures] = await Promise.all([
    listPendingRecordsRequest(),
    listUsersRequest(),
    listVehiclesRequest(),
    listDocumentsRequest(),
    listAppsheetSyncFailuresRequest(),
  ]);

  return sortBySeverity([
    ...computeLocationPermissionAlerts(users, pendingRecords),
    ...computeDriverDocumentAlerts(documents, users),
    ...computeVehicleDocumentAlerts(vehicles),
    ...computeVehicleMaintenanceAlerts(vehicles),
    ...computeBirthdayAlerts(users),
    ...computeAppsheetSyncAlerts(syncFailures),
  ]);
};

const NotificationsContext = createContext(null);

// Una sola fuente para toda la app: NotificationsBell (header, en cada pantalla) y
// Resumen (pestania Diario) antes llamaban cada uno a su propia copia de este fetch -
// mismos pedidos (users/vehiculos/pendientes/documentos) disparados varias veces en
// simultaneo en cada carga de pagina. Montado una vez en AppShell, todos comparten
// el mismo resultado.
export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const isChofer = user?.cargo === "CHOFER";
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  useEffect(() => {
    if (!isChofer && !isPrivileged) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const build = isChofer ? buildChoferAlerts : buildOwnerAlerts;

    const run = () => {
      setLoading(true);
      return build()
        .then((list) => {
          if (!cancelled) setAlerts(list);
        })
        .catch(() => {
          if (!cancelled) setAlerts([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    run();
    const intervalId = isPrivileged ? setInterval(run, OWNER_REFRESH_MS) : null;

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isChofer, isPrivileged, pathname]);

  return (
    <NotificationsContext.Provider value={{ alerts, loading }}>{children}</NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de un NotificationsProvider");
  return ctx;
};
