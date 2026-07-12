import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { parseApiError } from "../../lib/api";
import { RECORD_STATUS_LABELS, RECORD_STATUS_TONE } from "../../lib/constants";
import {
  computeCurrentServices,
  computeMyServiceCounts,
  computeWorkHours,
} from "../../lib/dashboardStats";
import { formatDateTime } from "../../lib/format";
import { listRecordsRequest, updateRecordRequest, uploadRecordFileRequest } from "../../lib/records.api";

// Solo el color de texto del estado, sin fondo ni borde (se usa en el resumen simple).
const STATUS_TEXT_TONE = {
  amber: "text-amber-300",
  blue: "text-accent-300",
  green: "text-[#4ddb6e]",
  slate: "text-ink-300",
  purple: "text-fuchsia-300",
  red: "text-[#ff6961]",
};

export const ChoferDashboardPage = () => {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");

  const [finishingId, setFinishingId] = useState(null);
  const [finishErrors, setFinishErrors] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadErrors, setUploadErrors] = useState({});

  const load = useCallback(() => {
    setError("");
    listRecordsRequest()
      .then(setRecords)
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Alert>{error}</Alert>;

  if (!records) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 border-white/20 border-t-white" />
      </div>
    );
  }

  const currentServices = computeCurrentServices(records);
  const myServiceCounts = computeMyServiceCounts(records);
  const workHours = computeWorkHours(records);

  const handleFinish = (recordId) => async () => {
    setFinishingId(recordId);
    setFinishErrors((prev) => ({ ...prev, [recordId]: "" }));
    try {
      const updated = await updateRecordRequest(recordId, { estado: "CONSEGNATO" });
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setFinishErrors((prev) => ({ ...prev, [recordId]: parseApiError(err).message }));
    } finally {
      setFinishingId(null);
    }
  };

  const handleUpload = (recordId) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingId(recordId);
    setUploadErrors((prev) => ({ ...prev, [recordId]: "" }));
    try {
      await uploadRecordFileRequest(recordId, file, "FOTO_ENTREGA");
      load();
    } catch (err) {
      setUploadErrors((prev) => ({ ...prev, [recordId]: parseApiError(err).message }));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Servicio actual</h2>

        {currentServices.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-300">
            No tienes servicios en curso ni pendientes.
          </p>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-white/10">
            {currentServices.map((service) => (
              <div key={service.id} className="py-4 first:pt-0 last:pb-0">
                <p className="text-[13px] text-ink-200">
                  <span className="font-medium text-ink-50">
                    {service.codigo} — {service.destinazione}
                  </span>{" "}
                  <span className={STATUS_TEXT_TONE[RECORD_STATUS_TONE[service.estado]]}>
                    ({RECORD_STATUS_LABELS[service.estado] || service.estado})
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-ink-400">
                  Cliente: {service.client?.nombre ?? "-"} &middot; Fecha:{" "}
                  {formatDateTime(service.fechaServicio)} &middot; Vehiculo:{" "}
                  {service.vehicle?.targa ?? "-"} - {service.vehicle?.modelo ?? ""}
                </p>

                <Alert>{finishErrors[service.id]}</Alert>
                <Alert>{uploadErrors[service.id]}</Alert>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleFinish(service.id)}
                    loading={finishingId === service.id}
                    className="sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]"
                  >
                    Finalizar servicio
                  </Button>

                  <label className="flex cursor-pointer items-center gap-2 rounded-full glass-surface-sm px-5 py-2 text-[13px] font-medium text-ink-50 hover:bg-white/10">
                    {uploadingId === service.id ? <Spinner className="h-3.5 w-3.5" /> : "Subir evidencia"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleUpload(service.id)}
                      disabled={uploadingId === service.id}
                    />
                  </label>

                  <Link
                    to={`/records/${service.id}`}
                    className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
                  >
                    Ver detalle completo &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Mis servicios</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Hoy" value={myServiceCounts.hoy} tone="blue" />
          <StatCard label="Pendientes" value={myServiceCounts.pendientes} tone="amber" />
          <StatCard label="Completados" value={myServiceCounts.completados} tone="green" />
          <StatCard label="Cancelados" value={myServiceCounts.cancelados} tone="red" />
        </div>
        <Link
          to="/records"
          className="mt-4 inline-block text-[13px] font-medium text-accent-400 hover:text-accent-300"
        >
          Ver historial completo &rarr;
        </Link>
      </GlassCard>

      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Horas de trabajo</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Horas hoy" value={workHours.horasHoy} />
          <StatCard label="Horas esta semana" value={workHours.horasSemana} />
          <StatCard label="Horas este mes" value={workHours.horasMes} />
          <StatCard label="Horas dia (mes)" value={workHours.horasDiaMes} />
          <StatCard label="Horas noche (mes)" value={workHours.horasNocheMes} />
          <StatCard label="Tiempo de espera (mes)" value={workHours.tiempoEsperaMes} />
        </div>
      </GlassCard>
    </div>
  );
};
