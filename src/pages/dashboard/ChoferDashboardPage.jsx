import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CerrarServicioModal } from "../../components/horas/CerrarServicioModal";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { RecepcionPaqueteCard } from "../../components/horas/RecepcionPaqueteCard";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { Switch } from "../../components/ui/Switch";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { RECORD_STATUS_LABELS, RECORD_STATUS_TONE } from "../../lib/constants";
import { computeCurrentServices, computeMyServiceCounts } from "../../lib/dashboardStats";
import { formatDateTime } from "../../lib/format";
import { needsHours } from "../../lib/horas";
import { getRecordRequest, listRecordsRequest, uploadRecordFileRequest } from "../../lib/records.api";
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

// Solo el color de texto del estado, sin fondo ni borde (se usa en el resumen simple).
const STATUS_TEXT_TONE = {
  pendiente: "text-status-pendiente",
  "in-corso": "text-status-in-corso",
  consegnato: "text-status-consegnato",
  ritirato: "text-status-ritirato",
  rischedulato: "text-status-rischedulato",
  annullato: "text-status-annullato",
};

export const ChoferDashboardPage = () => {
  const { user, setUser } = useAuth();
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");

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
    <div className="flex flex-col gap-6">
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

      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Mis servicios de hoy y proximos</h2>

        {currentServices.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-300">
            No tienes servicios en curso ni pendientes.
          </p>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-line/10">
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
                {service.origen && (
                  <p className="mt-1 text-[12px] font-medium text-accent-400">
                    Recibido de{" "}
                    {service.origen.chofer ? `${service.origen.chofer.nombre} ${service.origen.chofer.apellido}` : "otro chofer"}
                    {service.traspasoHora ? ` a las ${formatDateTime(service.traspasoHora)}` : " - falta indicar la hora de recepcion"}
                  </p>
                )}
                {service.relevo && (
                  <p className="mt-1 text-[12px] font-medium text-accent-400">
                    Lo termina {service.relevo.chofer.nombre} {service.relevo.chofer.apellido}
                    {service.relevo.traspasoHora ? ` (recibio el paquete a las ${formatDateTime(service.relevo.traspasoHora)})` : ""}
                  </p>
                )}
                <p className="mt-1 text-[12px] text-ink-400">
                  Cliente: {service.client?.nombre ?? "-"} &middot;{" "}
                  {service.fechaRetiro
                    ? `Retiro: ${formatDateTime(service.fechaRetiro)}`
                    : `Fecha: ${formatDateTime(service.fechaServicio)}`}{" "}
                  &middot; ETA: {formatDateTime(service.eta)} &middot; Vehiculo:{" "}
                  {service.vehicle?.targa ?? "-"} - {service.vehicle?.modelo ?? ""}
                </p>

                <Alert>{uploadErrors[service.id]}</Alert>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={openClose(service.id)}
                    loading={openingId === service.id}
                    disabled={Boolean(service.origen) && !service.traspasoHora}
                    className="sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]"
                  >
                    Terminar servicio
                  </Button>

                  <label className="flex cursor-pointer items-center gap-2 rounded-full glass-surface-sm px-5 py-2 text-[13px] font-medium text-ink-50 hover:bg-line/10">
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
        <h2 className="text-[17px] font-medium text-ink-50">¿Pasaste un peaje sin pagar?</h2>
        <p className="mt-1 text-[13px] text-ink-300">
          Sube el aviso de mancato pagamento apenas lo recibas: asi se asigna a tu servicio y no se te pasa el plazo.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            to="/finanzas/mancato/new"
            className="text-[13px] font-semibold text-accent-400 hover:text-accent-300"
          >
            Subir mancato pagamento &rarr;
          </Link>
          <Link to="/mis-horas" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            Ver mis horas y mi pago &rarr;
          </Link>
        </div>
      </GlassCard>

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
