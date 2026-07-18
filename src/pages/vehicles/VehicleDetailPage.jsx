import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { TextField } from "../../components/ui/TextField";
import { VehicleStatusBadge } from "../../components/ui/VehicleStatusBadge";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, GRUPO_OPTIONS, VEHICLE_STATUS_OPTIONS } from "../../lib/constants";
import { formatDate, toDateInputValue } from "../../lib/format";
import { getVehicleRequest, updateVehicleRequest } from "../../lib/vehicles.api";

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
const grupoLabel = (value) => GRUPO_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

const toFormState = (vehicle) => ({
  targa: vehicle.targa ?? "",
  modelo: vehicle.modelo ?? "",
  area: vehicle.area ?? "",
  grupo: vehicle.grupo ?? "",
  estado: vehicle.estado ?? "",
  poliza: toDateInputValue(vehicle.poliza),
  rTecnica: toDateInputValue(vehicle.rTecnica),
});

// Muestra el valor si esta cargado, o un placeholder atenuado si falta completarlo.
const VehicleStat = ({ label, value, tone }) => {
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

const TruckIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M2 6.5h10.5v9H2v-9zm10.5 3H17l3.5 3v3h-8v-6zM6 18.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5zm11 0a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Fila de un documento del vehiculo: atenuada si falta, con selector de archivo y su propia
// fecha de vencimiento (poliza para Assicurazione, revision tecnica para Libreto).
const VehicleDocumentField = ({
  label,
  url,
  editing,
  fileName,
  onFileChange,
  dateLabel,
  dateValue,
  onDateChange,
}) => {
  const hasDoc = Boolean(url) || Boolean(fileName);
  return (
    <div className={`glass-surface-sm rounded-xl px-4 py-3 ${hasDoc ? "" : "opacity-40"}`}>
      <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
      {!editing ? (
        url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[14px] text-accent-400 hover:text-accent-300"
          >
            Ver documento
          </a>
        ) : (
          <span className="text-[14px] text-ink-50">Sin subir</span>
        )
      ) : (
        <label className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded-lg glass-input px-3 py-2 text-[13px] text-ink-50 hover:bg-line/10">
          <span className="truncate">
            {fileName ?? (url ? "Reemplazar archivo" : "Subir archivo")}
          </span>
          <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
        </label>
      )}

      <div className="mt-2 border-t border-line/10 pt-2">
        {editing ? (
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-400">
              {dateLabel}
            </span>
            <input
              type="date"
              value={dateValue}
              onChange={onDateChange}
              className="glass-input w-full rounded-lg px-2 py-1 text-[13px] text-ink-50"
            />
          </label>
        ) : (
          <span
            className={`block text-[12px] ${dateValue ? "text-ink-300" : "text-ink-400 opacity-60"}`}
          >
            {dateLabel}: {dateValue ? formatDate(dateValue) : "Sin completar"}
          </span>
        )}
      </div>
    </div>
  );
};

export const VehicleDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [vehicle, setVehicle] = useState(null);
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState({});
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(() => {
    if (!isPrivileged) return;
    setLoadError("");
    getVehicleRequest(id)
      .then((data) => {
        setVehicle(data);
        setForm(toFormState(data));
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

  const handleFileChange = (field) => (e) =>
    setFiles((prev) => ({ ...prev, [field]: e.target.files?.[0] ?? null }));

  const startEditing = () => {
    setSaveSuccess(false);
    setSaveError("");
    setFieldErrors({});
    setFiles({});
    setForm(toFormState(vehicle));
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(toFormState(vehicle));
    setFiles({});
    setEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    setSaveSuccess(false);

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== "") formData.append(key, value);
    });
    Object.entries(files).forEach(([key, file]) => {
      if (file) formData.append(key, file);
    });

    try {
      const updated = await updateVehicleRequest(id, formData);
      setVehicle(updated);
      setForm(toFormState(updated));
      setFiles({});
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

  if (loadError) {
    return (
      <SlideOverPanel closeTo="/vehiculos">
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  if (!vehicle || !form) {
    return (
      <SlideOverPanel closeTo="/vehiculos">
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 border-line/20 border-t-line" />
        </div>
      </SlideOverPanel>
    );
  }

  return (
    <SlideOverPanel closeTo="/vehiculos">
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/vehiculos" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          &larr; Vehiculos
        </Link>
        {!editing && (
          <Button variant="ghost" className="sm:w-auto sm:px-8" onClick={startEditing}>
            Editar vehiculo
          </Button>
        )}
      </div>

      {saveSuccess && <Alert variant="success">Cambios guardados correctamente.</Alert>}

      <GlassCard>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          {vehicle.imagenUrl ? (
            <img
              src={vehicle.imagenUrl}
              alt={vehicle.targa}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-accent-500/20 text-accent-300 opacity-40">
              <TruckIcon className="h-8 w-8" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold text-ink-50">{vehicle.targa}</h1>
            <p className="text-[14px] text-ink-300">{vehicle.modelo}</p>
            {!editing && !vehicle.imagenUrl && (
              <p className="mt-0.5 text-[12px] text-ink-400">Sin foto</p>
            )}
          </div>
          {!editing && <VehicleStatusBadge status={vehicle.estado} />}
        </div>

        {editing && (
          <div className="mt-4 flex flex-col items-center gap-2 sm:items-start">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full glass-input px-4 py-2 text-[13px] font-medium text-ink-50 hover:bg-line/10">
              <span className="truncate">
                {files.imagen?.name ?? (vehicle.imagenUrl ? "Reemplazar foto" : "Subir foto del vehiculo")}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange("imagen")}
              />
            </label>
          </div>
        )}

        {!editing ? (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <VehicleStat label="Area" value={areaLabel(vehicle.area)} />
            <VehicleStat label="Grupo" value={vehicle.grupo ? grupoLabel(vehicle.grupo) : null} />
          </div>
        ) : (
          <form className="mt-8 flex flex-col gap-5" onSubmit={handleSave}>
            <Alert>{saveError}</Alert>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                id="targa"
                label="Targa"
                value={form.targa}
                onChange={handleChange("targa")}
                error={fieldErrors.targa?.[0]}
                required
              />
              <TextField
                id="modelo"
                label="Modelo"
                value={form.modelo}
                onChange={handleChange("modelo")}
                error={fieldErrors.modelo?.[0]}
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
                label="Estado"
                placeholder="Escribe para buscar un estado"
                options={VEHICLE_STATUS_OPTIONS}
                value={form.estado}
                onChange={(v) => setField("estado", v)}
                error={fieldErrors.estado?.[0]}
              />
            </div>

            <div className="border-t border-line/10 pt-5">
              <h3 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-ink-400">
                Documentos
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <VehicleDocumentField
                  label="Libreto"
                  url={vehicle.libretoUrl}
                  editing
                  fileName={files.libreto?.name}
                  onFileChange={handleFileChange("libreto")}
                  dateLabel="Vence revision tecnica"
                  dateValue={form.rTecnica}
                  onDateChange={handleChange("rTecnica")}
                />
                <VehicleDocumentField
                  label="Assicurazione"
                  url={vehicle.assicurazioneUrl}
                  editing
                  fileName={files.assicurazione?.name}
                  onFileChange={handleFileChange("assicurazione")}
                  dateLabel="Vence poliza"
                  dateValue={form.poliza}
                  onDateChange={handleChange("poliza")}
                />
              </div>
            </div>

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

        {!editing && (
          <div className="mt-6 border-t border-line/10 pt-6">
            <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
              Documentos
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <VehicleDocumentField
                label="Libreto"
                url={vehicle.libretoUrl}
                editing={false}
                dateLabel="Vence revision tecnica"
                dateValue={vehicle.rTecnica}
              />
              <VehicleDocumentField
                label="Assicurazione"
                url={vehicle.assicurazioneUrl}
                editing={false}
                dateLabel="Vence poliza"
                dateValue={vehicle.poliza}
              />
            </div>
          </div>
        )}
      </GlassCard>
    </div>
    </SlideOverPanel>
  );
};
