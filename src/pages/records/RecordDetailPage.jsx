import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ClientAutocomplete } from "../../components/ui/ClientAutocomplete";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { combineStopAddress, StopListEditor } from "../../components/records/StopListEditor";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import {
  APLICATIVO_OPTIONS,
  EXTRAS_PIAZZA_ZONA_LABELS,
  EXTRAS_PIAZZA_ZONA_OPTIONS,
  RECORD_STATUS_OPTIONS,
  TIPO_ARCHIVO_LABELS,
} from "../../lib/constants";
import { formatDateTime, toDateTimeInputValue } from "../../lib/format";
import {
  deleteRecordRequest,
  getRecordRequest,
  listRecordFilesRequest,
  updateRecordRequest,
  uploadRecordFileRequest,
} from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const OPERATIONAL_FIELDS = [
  "estado",
  "horasDia",
  "horasNoche",
  "tiempoEspera",
  "comentarios",
  "kilometrosReales",
];

// Solo OWNER/ADMIN pueden tocar estos campos; el backend ya lo restringe igual
// (SELF_EDITABLE_FIELDS en record.service.js), esto es solo para no mandarlos si es CHOFER.
const OWNER_FIELDS = [
  "codigo",
  "clientId",
  "driverId",
  "vehicleId",
  "aplicativo",
  "extrasPiazzaZona",
  "stops",
  "descripcion",
  "ciudad",
  "fechaServicio",
  "eta",
  "kilometros",
  "precioKm",
  "areaC",
  "costoEspera",
  "costoTraforoFrejusBrennero",
  "peajes",
  "vignetta",
  "costoHotel",
  "pagoRecibido",
  "costoCombustible",
  "clienteConfirmado",
];

const toFormState = (record) => ({
  estado: record.estado ?? "",
  horasDia: record.horasDia ?? "",
  horasNoche: record.horasNoche ?? "",
  tiempoEspera: record.tiempoEspera ?? "",
  comentarios: record.comentarios ?? "",
  kilometrosReales: record.kilometrosReales ?? "",
  codigo: record.codigo ?? "",
  clientId: record.client?.id ?? "",
  driverId: record.driver?.id ?? "",
  vehicleId: record.vehicle?.id ?? "",
  aplicativo: record.aplicativo ?? "",
  extrasPiazzaZona: record.extrasPiazzaZona ?? "",
  stops: record.stops?.length
    ? record.stops.map((s) => ({ direccion: s.direccion, cap: "" }))
    : [{ direccion: "", cap: "" }],
  descripcion: record.descripcion ?? "",
  ciudad: record.ciudad ?? "",
  fechaServicio: toDateTimeInputValue(record.fechaServicio),
  eta: toDateTimeInputValue(record.eta),
  kilometros: record.kilometros ?? "",
  precioKm: record.precioKm ?? "",
  areaC: record.areaC ?? "",
  costoEspera: record.costoEspera ?? "",
  costoTraforoFrejusBrennero: record.costoTraforoFrejusBrennero ?? "",
  peajes: record.peajes ?? "",
  vignetta: record.vignetta ?? "",
  costoHotel: record.costoHotel ?? "",
  pagoRecibido: record.pagoRecibido ?? "",
  costoCombustible: record.costoCombustible ?? "",
  clienteConfirmado: record.clienteConfirmado ?? false,
});

// A que lista volver segun el tipo de servicio (tambien usado tras eliminar uno).
const backToSection = (record) =>
  record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE"
    ? "/records/dhl-ab-service"
    : "/records/extras-piazza";

const TrashIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

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

export const RecordDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isChofer = user?.cargo === "CHOFER";
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const { refresh: refreshRecords } = useDataRefresh("records");

  const [record, setRecord] = useState(null);
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [clients, setClients] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const load = useCallback(() => {
    setLoadError("");
    setIsEditing(false);
    Promise.all([getRecordRequest(id), listRecordFilesRequest(id)])
      .then(([recordData, filesData]) => {
        setRecord(recordData);
        setForm(toFormState(recordData));
        setFiles(filesData);
      })
      .catch((err) => setLoadError(parseApiError(err).message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isChofer) return;
    Promise.all([listUsersRequest(), listVehiclesRequest(), listClientsRequest()])
      .then(([users, vehiclesData, clientsData]) => {
        setDrivers(users.filter((u) => u.estado === "ACTIVO"));
        setVehicles(vehiclesData);
        setClients(clientsData);
      })
      .catch((err) => setLoadError(parseApiError(err).message));
  }, [isChofer]);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleCheckboxChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.checked }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    const fieldsToSubmit = isChofer ? OPERATIONAL_FIELDS : [...OPERATIONAL_FIELDS, ...OWNER_FIELDS];

    const payload = Object.fromEntries(
      fieldsToSubmit
        .map((field) => [
          field,
          field === "stops" ? form.stops.map(combineStopAddress).filter(Boolean) : form[field],
        ])
        .filter(([, value]) => value !== "" && value !== undefined)
    );

    try {
      const updated = await updateRecordRequest(id, payload);
      setRecord(updated);
      setForm(toFormState(updated));
      setSaveSuccess(true);
      refreshRecords();
    } catch (err) {
      setSaveError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const newFile = await uploadRecordFileRequest(id, file, "FOTO_ENTREGA");
      setFiles((prev) => [newFile, ...prev]);
    } catch (err) {
      setUploadError(parseApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelEdit = () => {
    setForm(toFormState(record));
    setSaveError("");
    setSaveSuccess(false);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteRecordRequest(id);
      refreshRecords();
      navigate(location.state?.from ?? backToSection(record), { replace: true });
    } catch (err) {
      setDeleteError(parseApiError(err).message);
      setDeleting(false);
    }
  };

  const fallbackCloseTo = location.state?.from ?? "/records/extras-piazza";

  if (loadError) {
    return (
      <SlideOverPanel closeTo={fallbackCloseTo}>
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  const dropdownsLoaded = isChofer || (drivers && vehicles && clients);

  if (!record || !form || !dropdownsLoaded) {
    return (
      <SlideOverPanel closeTo={fallbackCloseTo}>
        <PageLoader />
      </SlideOverPanel>
    );
  }

  const driverOptions = !isChofer
    ? drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }))
    : [];
  const vehicleOptions = !isChofer
    ? vehicles.map((v) => ({ value: v.id, label: `${v.targa} - ${v.modelo}` }))
    : [];

  const backTo = location.state?.from ?? backToSection(record);

  return (
    <SlideOverPanel closeTo={backTo}>
    <div className="flex flex-col gap-6">
      <div>
        <Link to={backTo} className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          &larr; {location.state?.from === "/mapa" ? "Mapa" : "Mis registros"}
        </Link>
      </div>

      {record.appsheetSyncFallido && (
        <div className="rounded-xl border border-status-rischedulato/25 bg-status-rischedulato/5 px-4 py-3 text-[13px] text-status-rischedulato">
          Este servicio se guardo en la app pero no se pudo sincronizar con AppSheet. Se va a
          reintentar la proxima vez que se edite, o se puede avisar a soporte para forzarlo antes.
        </div>
      )}

      {isEditing ? (
        <RecordEditForm
          record={record}
          form={form}
          isChofer={isChofer}
          driverOptions={driverOptions}
          vehicleOptions={vehicleOptions}
          clients={clients}
          setClients={setClients}
          saving={saving}
          saveError={saveError}
          saveSuccess={saveSuccess}
          handleChange={handleChange}
          setField={setField}
          handleCheckboxChange={handleCheckboxChange}
          onSubmit={handleSave}
          onCancel={handleCancelEdit}
        />
      ) : (
        <RecordSummaryView
          record={record}
          files={files}
          isChofer={isChofer}
          isPrivileged={isPrivileged}
          onEdit={() => setIsEditing(true)}
          onDeleteClick={() => {
            setDeleteError("");
            setShowDeleteConfirm(true);
          }}
          uploading={uploading}
          uploadError={uploadError}
          onUpload={handleUpload}
        />
      )}
    </div>

    <ConfirmModal
      open={showDeleteConfirm}
      title="Eliminar servicio"
      description={`Esta accion no se puede deshacer. Se va a eliminar el servicio ${record.codigo} - ${record.destinazione}.`}
      confirmLabel="Eliminar"
      error={deleteError}
      loading={deleting}
      onConfirm={handleDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </SlideOverPanel>
  );
};

// Vista de solo lectura: resumen del servicio + archivos. Es la vista por defecto al
// abrir un registro - el formulario de edicion (RecordEditForm) es una vista aparte,
// no un bloque que se despliega debajo de esta (ver isEditing en RecordDetailPage).
const RecordSummaryView = ({
  record,
  files,
  isChofer,
  isPrivileged,
  onEdit,
  onDeleteClick,
  uploading,
  uploadError,
  onUpload,
}) => (
  <>
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-medium text-ink-400">{record.codigo}</span>
          <h1 className="mt-0.5 text-[22px] font-semibold text-ink-50">{record.destinazione}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={record.estado} />
          <button
            type="button"
            aria-label="Editar servicio"
            title="Editar servicio"
            onClick={onEdit}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-accent-500/15 hover:text-accent-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/20"
          >
            <PencilIcon className="h-[16px] w-[16px]" />
          </button>
          {isPrivileged && (
            <button
              type="button"
              aria-label="Eliminar servicio"
              title="Eliminar servicio"
              onClick={onDeleteClick}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-danger-500/15 hover:text-danger-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-danger-500/20"
            >
              <TrashIcon className="h-[17px] w-[17px]" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 text-[15px] text-ink-200">{record.descripcion}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoRow label="Fecha de servicio" value={formatDateTime(record.fechaServicio)} />
        <InfoRow label="ETA" value={formatDateTime(record.eta)} />
        <InfoRow
          label="Vehiculo"
          value={`${record.vehicle?.targa ?? "-"} - ${record.vehicle?.modelo ?? ""}`}
        />
        <InfoRow label="Cliente" value={record.client?.nombre} />
        {record.ciudad && <InfoRow label="Ciudad" value={record.ciudad} />}
        {record.extrasPiazzaZona && (
          <InfoRow label="Zona" value={EXTRAS_PIAZZA_ZONA_LABELS[record.extrasPiazzaZona]} />
        )}
        <InfoRow
          label="Chofer"
          value={`${record.driver?.nombre ?? ""} ${record.driver?.apellido ?? ""}`}
        />
        {record.ruta?.duracionMin != null && (
          <InfoRow
            label="Ruta estimada"
            value={`${record.ruta.distanciaKm.toFixed(1)} km - ${Math.round(record.ruta.duracionMin)} min`}
          />
        )}
      </div>

      <div className="mt-6 border-t border-line/10 pt-6">
        <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
          Kilometraje
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InfoRow label="Km planificados" value={record.kilometros ?? "-"} />
          <InfoRow label="Km reales" value={record.kilometrosReales ?? "-"} />
          {!isChofer && (
            <InfoRow
              label="Diferencia"
              value={
                record.diferenciaKm != null
                  ? `${record.diferenciaKm > 0 ? "+" : ""}${record.diferenciaKm} km`
                  : "-"
              }
              tone={
                record.diferenciaKm > 0 ? "amber" : record.diferenciaKm < 0 ? "blue" : undefined
              }
            />
          )}
        </div>
      </div>

      {!isChofer && (
        <div className="mt-6 border-t border-line/10 pt-6">
          <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
            Detalle economico
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InfoRow label="Precio/km" value={record.precioKm ?? "-"} />
            <InfoRow label="Total estimado" value={record.total ?? "-"} />
            <InfoRow label="Monto recibido" value={record.pagoRecibido ?? "-"} />
          </div>
        </div>
      )}
    </GlassCard>

    <GlassCard>
      <h2 className="text-[17px] font-medium text-ink-50">Archivos</h2>
      <p className="mt-1 text-[13px] text-ink-300">
        {isChofer
          ? "Sube tu foto de entrega para confirmar el servicio."
          : "Documentos y comprobantes cargados para este registro."}
      </p>

      <Alert>{uploadError}</Alert>

      {isChofer && (
        <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl glass-input px-4 py-3 text-[14px] font-medium text-ink-50 hover:bg-line/10">
          {uploading ? <Spinner /> : "Subir foto de entrega"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onUpload}
            disabled={uploading}
          />
        </label>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {files.length === 0 && (
          <li className="text-[14px] text-ink-400">Todavia no hay archivos cargados.</li>
        )}
        {files.map((file) => (
          <li key={file.id}>
            <a
              href={file.archivoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl glass-surface-sm px-4 py-3 text-[14px] text-ink-50 hover:bg-line/10"
            >
              <span>{TIPO_ARCHIVO_LABELS[file.tipoArchivo] ?? file.tipoArchivo}</span>
              <span className="text-[12px] text-ink-400">{formatDateTime(file.createdAt)}</span>
            </a>
          </li>
        ))}
      </ul>
    </GlassCard>
  </>
);

// Vista de edicion, aparte de RecordSummaryView (ver comentario ahi) - se muestra en
// vez del resumen mientras isEditing es true, nunca junto a el.
const RecordEditForm = ({
  record,
  form,
  isChofer,
  driverOptions,
  vehicleOptions,
  clients,
  setClients,
  saving,
  saveError,
  saveSuccess,
  handleChange,
  setField,
  handleCheckboxChange,
  onSubmit,
  onCancel,
}) => {
  const isExtrasPiazza = record.spedizzione !== "DHL" && record.spedizzione !== "AB_SERVICE";

  return (
    <GlassCard>
      <h2 className="text-[17px] font-medium text-ink-50">
        {isChofer ? "Cargar datos de mi viaje" : "Editar servicio"}
      </h2>
      <p className="mt-1 text-[13px] text-ink-300">
        {isChofer
          ? "Kilometros reales, horas trabajadas, tiempo de espera y comentarios del servicio."
          : "Modifica cualquier dato del servicio, incluidos los planificados y economicos."}
      </p>

      <form className="mt-6 flex flex-col gap-5" onSubmit={onSubmit}>
        {saveSuccess && <Alert variant="success">Cambios guardados correctamente.</Alert>}
        <Alert>{saveError}</Alert>

        {!isChofer && (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                id="codigo"
                label="Codigo"
                value={form.codigo}
                onChange={handleChange("codigo")}
              />
              <ClientAutocomplete
                id="clientId"
                label="Cliente"
                clients={clients}
                value={form.clientId}
                onChange={(clientId) => setField("clientId", clientId)}
                onClientCreated={(client) => setClients((prev) => [...prev, client])}
              />
              <SearchableSelect
                id="driverId"
                label="Chofer"
                placeholder="Escribe para buscar un chofer"
                options={driverOptions}
                value={form.driverId}
                onChange={(v) => setField("driverId", v)}
              />
              <SearchableSelect
                id="vehicleId"
                label="Vehiculo"
                placeholder="Escribe para buscar un vehiculo"
                options={vehicleOptions}
                value={form.vehicleId}
                onChange={(v) => setField("vehicleId", v)}
              />
              {!isExtrasPiazza && (
                <SearchableSelect
                  id="aplicativo"
                  label="Numero de aplicativo"
                  placeholder="Escribe para buscar un aplicativo"
                  options={APLICATIVO_OPTIONS}
                  value={form.aplicativo}
                  onChange={(v) => setField("aplicativo", v)}
                />
              )}
              {isExtrasPiazza && (
                <SearchableSelect
                  id="extrasPiazzaZona"
                  label="Zona"
                  placeholder="Escribe para buscar una zona"
                  options={EXTRAS_PIAZZA_ZONA_OPTIONS}
                  value={form.extrasPiazzaZona}
                  onChange={(v) => setField("extrasPiazzaZona", v)}
                />
              )}
              <TextField
                id="ciudad"
                label="Ciudad"
                value={form.ciudad}
                onChange={handleChange("ciudad")}
              />
              <TextField
                id="fechaServicio"
                label="Fecha de servicio"
                type="datetime-local"
                value={form.fechaServicio}
                onChange={handleChange("fechaServicio")}
              />
              <TextField
                id="eta"
                label="ETA"
                type="datetime-local"
                value={form.eta}
                onChange={handleChange("eta")}
              />
            </div>

            <StopListEditor
              stops={form.stops}
              onChange={(stops) => setField("stops", stops)}
              disabled={saving}
            />

            <Textarea
              id="descripcion"
              label="Descripcion"
              value={form.descripcion}
              onChange={handleChange("descripcion")}
            />
          </>
        )}

        <SearchableSelect
          id="estado"
          label="Estado"
          placeholder="Escribe para buscar un estado"
          options={RECORD_STATUS_OPTIONS}
          value={form.estado}
          onChange={(v) => setField("estado", v)}
        />

        <TextField
          id="kilometrosReales"
          label={`Kilometros reales${record.kilometros != null ? ` (planificado: ${record.kilometros} km)` : ""}`}
          type="number"
          step="0.1"
          min="0"
          placeholder="Kilometros recorridos"
          value={form.kilometrosReales}
          onChange={handleChange("kilometrosReales")}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <TextField
            id="horasDia"
            label="Horas dia"
            type="number"
            step="0.5"
            min="0"
            value={form.horasDia}
            onChange={handleChange("horasDia")}
          />
          <TextField
            id="horasNoche"
            label="Horas noche"
            type="number"
            step="0.5"
            min="0"
            value={form.horasNoche}
            onChange={handleChange("horasNoche")}
          />
          <TextField
            id="tiempoEspera"
            label="Tiempo de espera (h)"
            type="number"
            step="0.5"
            min="0"
            value={form.tiempoEspera}
            onChange={handleChange("tiempoEspera")}
          />
        </div>

        <Textarea
          id="comentarios"
          label="Comentarios"
          placeholder="Notas sobre el servicio..."
          value={form.comentarios}
          onChange={handleChange("comentarios")}
        />

        {!isChofer && (
          <div className="border-t border-line/10 pt-5">
            <h3 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-ink-400">
              Datos economicos
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <TextField
                id="kilometros"
                label="Kilometros planificados"
                type="number"
                step="0.1"
                min="0"
                value={form.kilometros}
                onChange={handleChange("kilometros")}
              />
              <TextField
                id="precioKm"
                label="Precio por km"
                type="number"
                step="0.01"
                min="0"
                value={form.precioKm}
                onChange={handleChange("precioKm")}
              />
              <TextField
                id="pagoRecibido"
                label="Monto recibido"
                type="number"
                step="0.01"
                min="0"
                placeholder="Lo que efectivamente se cobro (columna MONTO en Sheets)"
                value={form.pagoRecibido}
                onChange={handleChange("pagoRecibido")}
              />
              <TextField
                id="costoCombustible"
                label="Costo combustible"
                type="number"
                step="0.01"
                min="0"
                value={form.costoCombustible}
                onChange={handleChange("costoCombustible")}
              />
              <TextField
                id="peajes"
                label="Peajes"
                type="number"
                step="0.01"
                min="0"
                value={form.peajes}
                onChange={handleChange("peajes")}
              />
              <TextField
                id="vignetta"
                label="Vignetta"
                type="number"
                step="0.01"
                min="0"
                value={form.vignetta}
                onChange={handleChange("vignetta")}
              />
              <TextField
                id="costoHotel"
                label="Costo de hotel"
                type="number"
                step="0.01"
                min="0"
                value={form.costoHotel}
                onChange={handleChange("costoHotel")}
              />
              <TextField
                id="costoTraforoFrejusBrennero"
                label="Traforo Frejus/Brennero"
                type="number"
                step="0.01"
                min="0"
                value={form.costoTraforoFrejusBrennero}
                onChange={handleChange("costoTraforoFrejusBrennero")}
              />
              <TextField
                id="areaC"
                label="Area C"
                type="number"
                step="0.01"
                min="0"
                value={form.areaC}
                onChange={handleChange("areaC")}
              />
              <TextField
                id="costoEspera"
                label="Costo de espera"
                type="number"
                step="0.01"
                min="0"
                value={form.costoEspera}
                onChange={handleChange("costoEspera")}
              />
            </div>

            <label className="mt-5 flex w-fit items-center gap-2 text-[14px] text-ink-200">
              <input
                type="checkbox"
                checked={form.clienteConfirmado}
                onChange={handleCheckboxChange("clienteConfirmado")}
                className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
              />
              Cliente confirmado
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={saving} className="sm:w-auto sm:px-8">
            Guardar cambios
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            className="sm:w-auto sm:px-8"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </GlassCard>
  );
};

const TONE_CLASSES = {
  amber: "text-status-rischedulato",
  blue: "text-accent-300",
};

const InfoRow = ({ label, value, tone }) => (
  <div className="glass-surface-sm rounded-xl px-4 py-3">
    <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className={`mt-0.5 block text-[15px] ${TONE_CLASSES[tone] ?? "text-ink-50"}`}>
      {value || "-"}
    </span>
  </div>
);
