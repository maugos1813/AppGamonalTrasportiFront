import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { Switch } from "../../components/ui/Switch";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import {
  AREA_OPTIONS,
  CARGO_LABELS,
  GRUPO_LABELS,
  GRUPO_OPTIONS,
  TIPO_DOCUMENTO_OPTIONS,
} from "../../lib/constants";
import {
  createDocumentRequest,
  listDocumentsRequest,
  updateDocumentRequest,
} from "../../lib/documents.api";
import { formatDate, toDateInputValue } from "../../lib/format";
import {
  deleteUserRequest,
  getUserRequest,
  updateUserRequest,
  uploadUserAvatarRequest,
} from "../../lib/users.api";

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

const ESTADO_OPTIONS = [
  { value: "ACTIVO", label: "Activo" },
  { value: "INACTIVO", label: "Inactivo" },
];

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
const estadoLabel = (value) => ESTADO_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

const toFormState = (driver) => ({
  nombre: driver.nombre ?? "",
  apellido: driver.apellido ?? "",
  correoElectronico: driver.correoElectronico ?? "",
  numeroCelular: driver.numeroCelular ?? "",
  area: driver.area ?? "",
  grupo: driver.grupo ?? "",
  cargo: driver.cargo ?? "CHOFER",
  estado: driver.estado ?? "",
  fechaNacimiento: toDateInputValue(driver.fechaNacimiento),
});

// Muestra el valor si esta cargado, o un placeholder atenuado si falta completarlo.
const DriverStat = ({ label, value, tone }) => {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <StatCard
      label={label}
      value={isEmpty ? "Sin completar" : value}
      tone={isEmpty ? undefined : tone}
      className={isEmpty ? "opacity-40" : undefined}
    />
  );
};

// Fila de un documento: atenuada si todavia no se subio, con boton para subir/reemplazar en edicion
// y su propia fecha de vencimiento (solo editable una vez que el archivo ya existe).
const DocumentRow = ({
  label,
  document,
  editing,
  uploading,
  error,
  onUpload,
  onDateChange,
  savingDate,
}) => {
  const hasDoc = Boolean(document);
  return (
    <div
      className={`glass-surface-sm rounded-xl px-4 py-3 ${hasDoc ? "" : "opacity-40"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
          {hasDoc ? (
            <a
              href={document.archivoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[14px] text-accent-400 hover:text-accent-300"
            >
              Ver documento
            </a>
          ) : (
            <span className="text-[14px] text-ink-50">Sin subir</span>
          )}
          {error && <span className="mt-1 block text-[12px] text-danger-500">{error}</span>}
        </div>

        {editing && (
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10">
            {uploading ? <Spinner className="h-3.5 w-3.5" /> : hasDoc ? "Reemplazar" : "Subir"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {hasDoc && (
        <div className="mt-2 border-t border-line/10 pt-2">
          {editing ? (
            <label className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-400">
                Vence
              </span>
              <input
                type="date"
                defaultValue={toDateInputValue(document.fechaScadenza)}
                onChange={onDateChange}
                disabled={savingDate}
                className="glass-input w-full rounded-lg px-2 py-1 text-[13px] text-ink-50"
              />
              {savingDate && <Spinner className="h-3.5 w-3.5" />}
            </label>
          ) : (
            <span
              className={`block text-[12px] ${document.fechaScadenza ? "text-ink-300" : "text-ink-400 opacity-60"}`}
            >
              Vence: {document.fechaScadenza ? formatDate(document.fechaScadenza) : "Sin completar"}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const DriverDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [driver, setDriver] = useState(null);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [documents, setDocuments] = useState(null);
  const [documentUploading, setDocumentUploading] = useState({});
  const [documentErrors, setDocumentErrors] = useState({});
  const [documentDateSaving, setDocumentDateSaving] = useState({});

  const load = useCallback(() => {
    if (!isPrivileged) return;
    setLoadError("");
    Promise.all([getUserRequest(id), listDocumentsRequest(id)])
      .then(([driverData, docs]) => {
        setDriver(driverData);
        setForm(toFormState(driverData));
        setDocuments(docs);
      })
      .catch((err) => setLoadError(parseApiError(err).message));
  }, [id, isPrivileged]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const startEditing = () => {
    setSaveSuccess(false);
    setSaveError("");
    setFieldErrors({});
    setAvatarError("");
    setForm(toFormState(driver));
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(toFormState(driver));
    setEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    setSaveSuccess(false);

    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== "")
    );

    try {
      const updated = await updateUserRequest(id, payload);
      setDriver(updated);
      setForm(toFormState(updated));
      setEditing(false);
      setSaveSuccess(true);
    } catch (err) {
      const parsed = parseApiError(err);
      setSaveError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteUserRequest(id);
      navigate("/choferes", { replace: true });
    } catch (err) {
      setDeleteError(parseApiError(err).message);
      setDeleting(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAvatar(true);
    setAvatarError("");

    try {
      const updated = await uploadUserAvatarRequest(id, file);
      setDriver(updated);
    } catch (err) {
      setAvatarError(parseApiError(err).message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDocumentUpload = (tipoDocumento) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setDocumentUploading((prev) => ({ ...prev, [tipoDocumento]: true }));
    setDocumentErrors((prev) => ({ ...prev, [tipoDocumento]: "" }));

    try {
      const existing = documentsByType[tipoDocumento];
      const updatedDoc = existing
        ? await updateDocumentRequest(existing.id, { file })
        : await createDocumentRequest(id, tipoDocumento, file);
      setDocuments((prev) => [updatedDoc, ...(prev ?? []).filter((d) => d.id !== updatedDoc.id)]);
    } catch (err) {
      setDocumentErrors((prev) => ({ ...prev, [tipoDocumento]: parseApiError(err).message }));
    } finally {
      setDocumentUploading((prev) => ({ ...prev, [tipoDocumento]: false }));
    }
  };

  const handleDocumentDateChange = (tipoDocumento) => async (e) => {
    const value = e.target.value;
    const existing = documentsByType[tipoDocumento];
    if (!existing || !value) return;

    setDocumentDateSaving((prev) => ({ ...prev, [tipoDocumento]: true }));
    setDocumentErrors((prev) => ({ ...prev, [tipoDocumento]: "" }));

    try {
      const updatedDoc = await updateDocumentRequest(existing.id, { fechaScadenza: value });
      setDocuments((prev) => [updatedDoc, ...(prev ?? []).filter((d) => d.id !== updatedDoc.id)]);
    } catch (err) {
      setDocumentErrors((prev) => ({ ...prev, [tipoDocumento]: parseApiError(err).message }));
    } finally {
      setDocumentDateSaving((prev) => ({ ...prev, [tipoDocumento]: false }));
    }
  };

  if (loadError) {
    return (
      <SlideOverPanel closeTo="/choferes">
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  if (!driver || !form || !documents) {
    return (
      <SlideOverPanel closeTo="/choferes">
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 border-line/20 border-t-line" />
        </div>
      </SlideOverPanel>
    );
  }

  const documentsByType = documents.reduce((acc, document) => {
    if (!acc[document.tipoDocumento]) acc[document.tipoDocumento] = document;
    return acc;
  }, {});

  return (
    <SlideOverPanel closeTo="/choferes">
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/choferes" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          &larr; Choferes
        </Link>
        {!editing && (
          <div className="flex items-center gap-2">
            {driver.id !== user.id && (
              <button
                type="button"
                aria-label="Eliminar chofer"
                title="Eliminar chofer"
                onClick={() => {
                  setDeleteError("");
                  setShowDeleteConfirm(true);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-danger-500/15 hover:text-danger-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-danger-500/20"
              >
                <TrashIcon className="h-[17px] w-[17px]" />
              </button>
            )}
            <Button variant="ghost" className="sm:w-auto sm:px-8" onClick={startEditing}>
              Editar chofer
            </Button>
          </div>
        )}
      </div>

      {saveSuccess && <Alert variant="success">Cambios guardados correctamente.</Alert>}

      <GlassCard>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar
            user={driver}
            className={`h-16 w-16 text-xl ${driver.imagenUrl ? "" : "opacity-40"}`}
          />
          <div>
            <h1 className="text-[22px] font-semibold text-ink-50">
              {driver.nombre} {driver.apellido}
            </h1>
            <p className="text-[14px] text-ink-300">{driver.correoElectronico}</p>
            {!editing && !driver.imagenUrl && (
              <p className="mt-0.5 text-[12px] text-ink-400">Sin foto de perfil</p>
            )}
          </div>
        </div>

        {editing && (
          <div className="mt-4 flex flex-col items-center gap-2 sm:items-start">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full glass-input px-4 py-2 text-[13px] font-medium text-ink-50 hover:bg-line/10">
              {uploadingAvatar ? <Spinner /> : "Cambiar foto de perfil"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </label>
            {avatarError && (
              <span className="text-[13px] text-danger-500">{avatarError}</span>
            )}
          </div>
        )}

        {!editing ? (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DriverStat label="Cargo" value={CARGO_LABELS[driver.cargo] ?? driver.cargo} />
            <DriverStat label="Grupo" value={driver.grupo ? GRUPO_LABELS[driver.grupo] : null} />
            <DriverStat label="Area" value={areaLabel(driver.area)} />
            <DriverStat
              label="Estado de la cuenta"
              value={estadoLabel(driver.estado)}
              tone={driver.estado === "ACTIVO" ? "green" : "red"}
            />
            <DriverStat label="Numero de celular" value={driver.numeroCelular} />
            <DriverStat label="Fecha de nacimiento" value={formatDate(driver.fechaNacimiento)} />
            <DriverStat label="Miembro desde" value={formatDate(driver.createdAt)} />
          </div>
        ) : (
          <form className="mt-8 flex flex-col gap-5" onSubmit={handleSave}>
            <Alert>{saveError}</Alert>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                id="nombre"
                label="Nombre"
                value={form.nombre}
                onChange={handleChange("nombre")}
                error={fieldErrors.nombre?.[0]}
                required
              />
              <TextField
                id="apellido"
                label="Apellido"
                value={form.apellido}
                onChange={handleChange("apellido")}
                error={fieldErrors.apellido?.[0]}
                required
              />
              <TextField
                id="correoElectronico"
                label="Correo electronico"
                type="email"
                value={form.correoElectronico}
                onChange={handleChange("correoElectronico")}
                error={fieldErrors.correoElectronico?.[0]}
                required
              />
              <TextField
                id="numeroCelular"
                label="Numero de celular"
                type="tel"
                value={form.numeroCelular}
                onChange={handleChange("numeroCelular")}
                error={fieldErrors.numeroCelular?.[0]}
                required
              />
              <SearchableSelect
                id="area"
                label="Area"
                placeholder="Escribe para buscar un area"
                options={AREA_OPTIONS}
                value={form.area}
                onChange={(v) => setField("area", v)}
                error={fieldErrors.area?.[0]}
              />
              <SearchableSelect
                id="grupo"
                label="Grupo"
                placeholder="Escribe para buscar un grupo"
                options={GRUPO_OPTIONS}
                value={form.grupo}
                onChange={(v) => setField("grupo", v)}
                error={fieldErrors.grupo?.[0]}
              />
              <SearchableSelect
                id="estado"
                label="Estado de la cuenta"
                placeholder="Escribe para buscar un estado"
                options={ESTADO_OPTIONS}
                value={form.estado}
                onChange={(v) => setField("estado", v)}
                error={fieldErrors.estado?.[0]}
              />
              <TextField
                id="fechaNacimiento"
                label="Fecha de nacimiento"
                type="date"
                value={form.fechaNacimiento}
                onChange={handleChange("fechaNacimiento")}
                error={fieldErrors.fechaNacimiento?.[0]}
                required
              />
            </div>

            {driver.id !== user.id && (
              <div className="border-t border-line/10 pt-5">
                <h3 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-ink-400">
                  Permisos
                </h3>
                <div className="flex flex-col gap-4">
                  <Switch
                    id="cargo-admin"
                    label="Responsable"
                    description="Puede gestionar choferes, vehiculos y registros de toda la empresa."
                    checked={form.cargo === "ADMIN" || form.cargo === "OWNER"}
                    onChange={(checked) =>
                      setField("cargo", checked ? (form.cargo === "OWNER" ? "OWNER" : "ADMIN") : "CHOFER")
                    }
                  />
                  {user.cargo === "OWNER" && (
                    <Switch
                      id="cargo-owner"
                      label="Socio"
                      description="Acceso total, incluida la asignacion de otros socios."
                      checked={form.cargo === "OWNER"}
                      onChange={(checked) => setField("cargo", checked ? "OWNER" : "ADMIN")}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" loading={saving} className="sm:w-auto sm:px-8">
                Guardar cambios
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="sm:w-auto sm:px-8"
                disabled={saving}
                onClick={cancelEditing}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </GlassCard>

      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Documentos</h2>
        <p className="mt-1 text-[13px] text-ink-300">
          Documentacion del chofer. Los que faltan por subir aparecen atenuados. Una vez subido
          cada PDF se le puede cargar su fecha de vencimiento.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TIPO_DOCUMENTO_OPTIONS.map((option) => (
            <DocumentRow
              key={option.value}
              label={option.label}
              document={documentsByType[option.value]}
              editing={editing}
              uploading={Boolean(documentUploading[option.value])}
              error={documentErrors[option.value]}
              onUpload={handleDocumentUpload(option.value)}
              onDateChange={handleDocumentDateChange(option.value)}
              savingDate={Boolean(documentDateSaving[option.value])}
            />
          ))}
        </div>
      </GlassCard>
    </div>

    <ConfirmModal
      open={showDeleteConfirm}
      title="Eliminar chofer"
      description={`Esta accion no se puede deshacer. Se va a eliminar a ${driver.nombre} ${driver.apellido}.`}
      confirmLabel="Eliminar"
      error={deleteError}
      loading={deleting}
      onConfirm={handleDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </SlideOverPanel>
  );
};
