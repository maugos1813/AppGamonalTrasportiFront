import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { parseApiError } from "../../lib/api";
import {
  computeCurrentService,
  computeMyServiceCounts,
  computeWorkHours,
} from "../../lib/dashboardStats";
import { formatDateTime } from "../../lib/format";
import { listRecordsRequest, updateRecordRequest, uploadRecordFileRequest } from "../../lib/records.api";

export const ChoferDashboardPage = () => {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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

  const currentService = computeCurrentService(records);
  const myServiceCounts = computeMyServiceCounts(records);
  const workHours = computeWorkHours(records);

  const handleFinish = async () => {
    if (!currentService) return;
    setFinishing(true);
    setFinishError("");
    try {
      const updated = await updateRecordRequest(currentService.id, { estado: "CONSEGNATO" });
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setFinishError(parseApiError(err).message);
    } finally {
      setFinishing(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentService) return;

    setUploading(true);
    setUploadError("");
    try {
      await uploadRecordFileRequest(currentService.id, file, "FOTO_ENTREGA");
      load();
    } catch (err) {
      setUploadError(parseApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Servicio actual</h2>

        {!currentService ? (
          <p className="mt-4 text-[14px] text-ink-300">
            No tienes un servicio en curso ni programado para hoy.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-[13px] font-medium text-ink-400">{currentService.codigo}</span>
                <h3 className="mt-0.5 text-[19px] font-medium text-ink-50">
                  {currentService.destinazione}
                </h3>
              </div>
              <StatusBadge status={currentService.estado} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Cliente" value={currentService.client?.nombre ?? "-"} />
              <StatCard label="Fecha" value={formatDateTime(currentService.fechaServicio)} />
              <StatCard
                label="Vehiculo"
                value={`${currentService.vehicle?.targa ?? "-"} - ${currentService.vehicle?.modelo ?? ""}`}
              />
            </div>

            <Alert>{finishError}</Alert>
            <Alert>{uploadError}</Alert>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleFinish}
                loading={finishing}
                disabled={currentService.estado === "CONSEGNATO"}
                className="sm:w-auto sm:px-6"
              >
                Finalizar servicio
              </Button>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full glass-surface-sm px-6 py-3 text-[15px] font-medium text-ink-50 hover:bg-white/10 sm:w-auto">
                {uploading ? <Spinner /> : "Subir evidencia"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>

              <Link
                to={`/records/${currentService.id}`}
                className="flex items-center justify-center px-2 text-[13px] font-medium text-accent-400 hover:text-accent-300"
              >
                Ver detalle completo &rarr;
              </Link>
            </div>
          </>
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
