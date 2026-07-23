import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ClientAutocomplete } from "../../components/ui/ClientAutocomplete";
import { GlassCard } from "../../components/ui/GlassCard";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import { APLICATIVO_OPTIONS, RECORD_STATUS_OPTIONS, SPEDIZZIONE_OPTIONS } from "../../lib/constants";
import { createRecordRequest } from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const INITIAL_FORM = {
  clientId: "",
  driverId: "",
  vehicleId: "",
  aplicativo: "",
  spedizzione: "DHL",
  estado: "IN_SOSPESO",
  fechaServicio: "",
  eta: "",
  descripcion: "",
  comentarios: "",
  ciudad: "",
  calle: "",
  cap: "",
  kilometros: "",
  areaC: "",
  costoEspera: "",
  costoCombustible: "",
  peajes: "",
  vignetta: "",
  costoHotel: "",
  costoTraforoFrejusBrennero: "",
};

// Arma la direccion de la parada final a partir de calle/CAP/ciudad, en el mismo
// formato que ya geocodifica el backend (ej: "Via Roma 5, 20100 Milano").
const buildAddress = ({ calle, cap, ciudad }) => {
  const parts = [calle.trim()];
  const capCiudad = [cap.trim(), ciudad.trim()].filter(Boolean).join(" ");
  if (capCiudad) parts.push(capCiudad);
  return parts.filter(Boolean).join(", ");
};

export const NewDhlAbServiceRecordPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const [form, setForm] = useState(INITIAL_FORM);
  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [clients, setClients] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    Promise.all([listUsersRequest(), listVehiclesRequest(), listClientsRequest()])
      .then(([users, vehiclesData, clientsData]) => {
        setDrivers(users.filter((u) => u.cargo === "CHOFER" && u.estado === "ACTIVO"));
        setVehicles(vehiclesData);
        setClients(clientsData);
      })
      .catch((err) => setLoadError(parseApiError(err).message));
  }, []);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    const { calle, cap, ciudad, ...rest } = form;
    const direccion = buildAddress({ calle, cap, ciudad });
    // DHL/AB Service no maneja codigos propios: se genera uno interno solo para
    // cumplir la columna unica de la base, no se le muestra al usuario.
    const codigo = `${form.spedizzione}-${Date.now()}`;

    const payload = Object.fromEntries(
      Object.entries({ ...rest, codigo, ciudad, stops: [direccion] }).filter(
        ([key, value]) => key === "stops" || value !== ""
      )
    );

    try {
      const record = await createRecordRequest(payload);
      navigate(`/records/${record.id}`, { replace: true });
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  if (!isPrivileged) return <Navigate to="/records/dhl-ab-service" replace />;

  if (loadError) {
    return (
      <SlideOverPanel closeTo="/records/dhl-ab-service">
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  const loaded = drivers && vehicles && clients;

  if (!loaded) {
    return (
      <SlideOverPanel closeTo="/records/dhl-ab-service">
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 border-line/20 border-t-line" />
        </div>
      </SlideOverPanel>
    );
  }

  const driverOptions = drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }));
  const vehicleOptions = vehicles.map((v) => ({
    value: v.id,
    label: `${v.targa} - ${v.modelo}`,
  }));

  return (
    <SlideOverPanel closeTo="/records/dhl-ab-service">
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/records/dhl-ab-service"
          className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
        >
          &larr; Mis registros
        </Link>
      </div>

      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Nuevo servicio - DHL / AB Service</h1>
        <p className="mt-1 text-[14px] text-ink-300">Completa los datos para crear un servicio.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Datos del servicio</h2>

          <Alert>{formError}</Alert>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SearchableSelect
              id="estado"
              label="Estado"
              placeholder="Escribe para buscar un estado"
              options={RECORD_STATUS_OPTIONS}
              value={form.estado}
              onChange={(v) => setField("estado", v)}
            />

            <SearchableSelect
              id="driverId"
              label="Chofer"
              placeholder="Escribe para buscar un chofer"
              options={driverOptions}
              value={form.driverId}
              onChange={(v) => setField("driverId", v)}
              error={fieldErrors.driverId?.[0]}
            />

            <SearchableSelect
              id="vehicleId"
              label="Targa"
              placeholder="Escribe para buscar una targa"
              options={vehicleOptions}
              value={form.vehicleId}
              onChange={(v) => setField("vehicleId", v)}
              error={fieldErrors.vehicleId?.[0]}
            />

            <TextField
              id="fechaServicio"
              label="Data"
              type="datetime-local"
              value={form.fechaServicio}
              onChange={handleChange("fechaServicio")}
              error={fieldErrors.fechaServicio?.[0]}
              required
            />

            <TextField
              id="eta"
              label="ETA"
              type="datetime-local"
              value={form.eta}
              onChange={handleChange("eta")}
              error={fieldErrors.eta?.[0]}
              required
            />

            <SearchableSelect
              id="spedizzione"
              label="Spedizzione"
              placeholder="Escribe para buscar una spedizzione"
              options={SPEDIZZIONE_OPTIONS}
              value={form.spedizzione}
              onChange={(v) => setField("spedizzione", v)}
              error={fieldErrors.spedizzione?.[0]}
            />

            <ClientAutocomplete
              id="clientId"
              label="Cliente"
              clients={clients}
              value={form.clientId}
              onChange={(clientId) => setField("clientId", clientId)}
              onClientCreated={(client) => setClients((prev) => [...prev, client])}
              error={fieldErrors.clientId?.[0]}
            />

            <SearchableSelect
              id="aplicativo"
              label="Numero de aplicativo"
              placeholder="Escribe para buscar un aplicativo"
              options={APLICATIVO_OPTIONS}
              value={form.aplicativo}
              onChange={(v) => setField("aplicativo", v)}
              error={fieldErrors.aplicativo?.[0]}
            />
          </div>

          <div className="mt-5">
            <Textarea
              id="descripcion"
              label="Descripcion"
              placeholder="Detalle del servicio a realizar..."
              value={form.descripcion}
              onChange={handleChange("descripcion")}
              error={fieldErrors.descripcion?.[0]}
              required
            />
          </div>

          <div className="mt-5">
            <Textarea
              id="comentarios"
              label="Notas"
              placeholder="Notas adicionales del servicio..."
              value={form.comentarios}
              onChange={handleChange("comentarios")}
              error={fieldErrors.comentarios?.[0]}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Destinazzione</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Lugar de consegna. Completa calle, CAP y ciudad por separado para que la busqueda en el
            mapa sea mas precisa.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <TextField
              id="calle"
              label="Calle / direccion"
              placeholder="Ej: Via delle Industrie, 2e"
              className="sm:col-span-2"
              value={form.calle}
              onChange={handleChange("calle")}
              error={fieldErrors.stops?.[0]}
              required
            />
            <TextField
              id="cap"
              label="CAP"
              placeholder="Ej: 26014"
              value={form.cap}
              onChange={handleChange("cap")}
            />
            <TextField
              id="ciudad"
              label="Ciudad"
              placeholder="Ej: Romanengo CR"
              className="sm:col-span-3"
              value={form.ciudad}
              onChange={handleChange("ciudad")}
              error={fieldErrors.ciudad?.[0]}
              required
            />
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Kilometraje y costos</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Kilometros planificados. El chofer carga despues los kilometros reales para la
            comparativa.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <TextField
              id="kilometros"
              label="Km planificados"
              type="number"
              step="0.1"
              min="0"
              value={form.kilometros}
              onChange={handleChange("kilometros")}
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
              label="Peajes exterior"
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
          </div>
        </GlassCard>

        <Button type="submit" loading={submitting} className="sm:w-auto sm:px-8">
          Crear servicio
        </Button>
      </form>
    </div>
    </SlideOverPanel>
  );
};
