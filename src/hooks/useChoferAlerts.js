import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { computeCurrentService, computeOverdueServices } from "../lib/dashboardStats";
import { formatDate } from "../lib/format";
import { listRecordFilesRequest, listRecordsRequest } from "../lib/records.api";
import { getVehicleRequest } from "../lib/vehicles.api";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// Alertas operativas del chofer (vencimientos, mantenimiento del vehiculo asignado,
// evidencia faltante). Solo aplica al rol CHOFER: OWNER/ADMIN no tienen este concepto todavia.
export const useChoferAlerts = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.cargo !== "CHOFER") {
      setAlerts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const buildAlerts = async () => {
      const records = await listRecordsRequest();
      const list = [];

      computeOverdueServices(records).forEach((record) => {
        list.push({
          id: `overdue-${record.id}`,
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
              message: `El vehiculo asignado (${vehicle.targa}) esta en mantenimiento.`,
            });
          }
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
            message: `Falta subir la foto de entrega del servicio ${record.codigo}.`,
          });
        }
      });

      return list;
    };

    buildAlerts()
      .then((list) => {
        if (!cancelled) setAlerts(list);
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.cargo, pathname]);

  return { alerts, loading };
};
