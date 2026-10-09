import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetaKmCard } from "../../components/chofer/MetaKmCard";
import { MancatoBanner } from "../../components/chofer/MancatoBanner";
import { ResumenServiciosCard } from "../../components/chofer/ResumenServiciosCard";
import { ServiciosActualesCard } from "../../components/chofer/ServiciosActualesCard";
import { CerrarServicioModal } from "../../components/horas/CerrarServicioModal";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { RecepcionPaqueteCard } from "../../components/horas/RecepcionPaqueteCard";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { Switch } from "../../components/ui/Switch";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { computeCurrentServices, computeMyServiceCounts } from "../../lib/dashboardStats";
import { formatDateTime } from "../../lib/format";
import { needsHours } from "../../lib/horas";
import { getRecordRequest, listRecordsRequest, uploadRecordFileRequest } from "../../lib/records.api";
import { getMyProgressRequest } from "../../lib/metas.api";
import { updateMyReperibilidadRequest } from "../../lib/users.api";

const PENDING_HOURS_DAYS = 14;

// Mismo criterio de "es de hoy" que dashboardStats.js (comparacion en hora local del
// navegador) - si reperibilidadActualizada no es de hoy, el flag quedo de un dia
// anterior y se trata como si no estuviera marcado.
const isToday = (value) => {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
};

export const ChoferDashboardPage = () => {
  const { user, setUser } = useAuth();
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);

  // Servicio al que se le estan cargando las horas (modal "Terminar servicio").
  const [closing, setClosing] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadErrors, setUploadErrors] = useState({});

  const [savingReperibilidad, setSavingReperibilidad] = useState(false);
  const [reperibilidadError, setReperibilidadError] = useState("");

  const handleToggleReperibilidad = async (checked) => {
    setSavingReperibilidad(true);
    setReperibilidadError("");
    try {
      // El switch muestra "no disponible" activado; el backend guarda ese mismo booleano.
      const updated = await updateMyReperibilidadRequest(checked);
      setUser(updated);
    } catch (err) {
      setReperibilidadError(parseApiError(err).message);
    } finally {
      setSavingReperibilidad(false);
    }
  };

  const load = useCallback(() => {
    setError("");
    listRecordsRequest()
      .then(setRecords)
      .catch((err) => setError(parseApiError(err).message));
    // La meta es un extra: si falla, el resto del dashboard se ve igual.
    getMyProgressRequest()
      .then(setProgress)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Alert>{error}</Alert>;

  if (!records) return <PageLoader />;

  const currentServices = computeCurrentServices(records);
  // Servicios que otro chofer no pudo terminar y se le asignaron a este: falta la hora de recepcion.
  const awaitingReception = records.filter((r) => r.origen && !r.traspasoHora && r.estado !== "ANNULLATO");
  const myServiceCounts = computeMyServiceCounts(records);
  // Solo los ultimos dias: los servicios viejos sin horas no se recuerdan aca (se ven en Mis horas).
  const recentCutoff = Date.now() - PENDING_HOURS_DAYS * 24 * 60 * 60 * 1000;
  const pendingHours = records
    .filter((r) => needsHours(r) && new Date(r.fechaServicio).getTime() >= recentCutoff)
    .sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio));

  // Se pide el servicio completo (con paradas y jornada) para precargar el formulario.
  const openClose = (recordId) => async () => {
    setOpeningId(recordId);
    setUploadErrors((prev) => ({ ...prev, [recordId]: "" }));
    try {
      setClosing(await getRecordRequest(recordId));
    } catch (err) {
      setUploadErrors((prev) => ({ ...prev, [recordId]: parseApiError(err).message }));
    } finally {
      setOpeningId(null);
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
    <div className="flex flex-col gap-5">
      {user?.area === "EXTRAS_PIAZZA" && (
        <GlassCard>
          <Alert>{reperibilidadError}</Alert>
          <Switch
            id="reperibilidad-no-disponible"
            label="No estoy disponible esta noche"
            description="Activalo si no queres aparecer en el listado de reperibilita por si sale un pedido de Extras Piazza. Se resetea solo al dia siguiente."
            checked={Boolean(user?.reperibilidadNoDisponible) && isToday(user?.reperibilidadActualizada)}
            disabled={savingReperibilidad}
            onChange={handleToggleReperibilidad}
          />
        </GlassCard>
      )}

      {awaitingReception.length > 0 && (
        <GlassCard className="border border-warning-500/30">
          <div className="flex flex-col divide-y divide-line/10">
            {awaitingReception.map((record) => (
              <RecepcionPaqueteCard key={record.id} record={record} onDone={load} className="py-3 first:pt-0 last:pb-0" />
            ))}
          </div>
        </GlassCard>
      )}

      <ServiciosActualesCard
        services={currentServices}
        openingId={openingId}
        uploadingId={uploadingId}
        errors={uploadErrors}
        onClose={openClose}
        onUpload={handleUpload}
      />

      <MetaKmCard progress={progress} />

      <ResumenServiciosCard counts={myServiceCounts} />

      {pendingHours.length > 0 && (
        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Horas por cargar</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Servicios ya entregados sin horas aprobadas: mientras tanto se pagan por kilometros.
          </p>
          <div className="mt-4 flex flex-col divide-y divide-line/10">
            {pendingHours.slice(0, 5).map((service) => (
              <div key={service.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink-50">
                    {service.codigo} — {service.destinazione}
                  </span>
                  <span className="block text-[12px] text-ink-400">{formatDateTime(service.fechaServicio)}</span>
                  {service.jornada?.estado === "DEVUELTAS" && service.jornada.nota && (
                    <span className="mt-0.5 block text-[12px] text-danger-500">{service.jornada.nota}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <HorasEstadoChip estado={service.jornada?.estado} />
                  <Button
                    onClick={openClose(service.id)}
                    loading={openingId === service.id}
                    className="sm:w-auto sm:px-4 sm:py-1.5 sm:text-[13px]"
                  >
                    {service.jornada?.estado === "DEVUELTAS" ? "Corregir" : "Cargar horas"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {pendingHours.length > 5 && (
            <Link to="/mis-horas" className="mt-3 inline-block text-[13px] font-medium text-accent-400 hover:text-accent-300">
              Ver los {pendingHours.length} servicios &rarr;
            </Link>
          )}
        </GlassCard>
      )}

      <MancatoBanner />

      {closing && (
        <CerrarServicioModal
          record={closing}
          onClose={() => setClosing(null)}
          onDone={load}
        />
      )}
    </div>
  );
};
