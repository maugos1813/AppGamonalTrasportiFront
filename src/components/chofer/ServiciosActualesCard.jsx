import clsx from "clsx";
import { Link } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Spinner } from "../ui/Spinner";
import { CalendarIcon, ChevronRightIcon, ClockIcon, FileTextIcon, TruckIcon, UserIcon } from "../ui/icons";
import { TruckArt } from "./illustrations";
import { RECORD_STATUS_LABELS, RECORD_STATUS_TONE } from "../../lib/constants";
import { formatDateTime } from "../../lib/format";

const PlayIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </svg>
);

const STATUS_PILL = {
  pendiente: "bg-status-pendiente/20 text-ink-200",
  "in-corso": "bg-status-in-corso/20 text-accent-300",
  consegnato: "bg-status-consegnato/20 text-success-500",
  ritirato: "bg-status-ritirato/20 text-status-ritirato",
  rischedulato: "bg-status-rischedulato/20 text-status-rischedulato",
  annullato: "bg-status-annullato/20 text-danger-500",
};

const InfoItem = ({ icon: Icon, children }) => (
  <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-200">
    <Icon className="h-4 w-4 shrink-0 text-ink-400" />
    <span className="min-w-0">{children}</span>
  </span>
);

const ServiceBlock = ({ service, opening, uploading, error, onClose, onUpload }) => {
  const tone = RECORD_STATUS_TONE[service.estado];
  const waitingReception = Boolean(service.origen) && !service.traspasoHora;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-semibold leading-snug text-ink-50">
          {service.codigo} <span className="font-normal text-ink-300">—</span> {service.destinazione}{" "}
          <span
            className={clsx(
              "ml-1 inline-block rounded-md px-2 py-0.5 align-middle text-[11px] font-medium",
              STATUS_PILL[tone]
            )}
          >
            {RECORD_STATUS_LABELS[service.estado] || service.estado}
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
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <InfoItem icon={UserIcon}>Cliente: {service.client?.nombre ?? "-"}</InfoItem>
        <InfoItem icon={CalendarIcon}>
          {service.fechaRetiro
            ? `Retiro: ${formatDateTime(service.fechaRetiro)}`
            : `Fecha: ${formatDateTime(service.fechaServicio)}`}
        </InfoItem>
        <InfoItem icon={ClockIcon}>ETA: {formatDateTime(service.eta)}</InfoItem>
        <InfoItem icon={TruckIcon}>
          Vehiculo: {service.vehicle?.targa ?? "-"}
          {service.vehicle?.modelo ? ` - ${service.vehicle.modelo}` : ""}
        </InfoItem>
      </div>

      <Alert>{error}</Alert>

      <button
        type="button"
        onClick={onClose}
        disabled={opening || waitingReception}
        className="group flex w-full items-center justify-between gap-3 rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-brand-foreground shadow-[0_8px_24px_-10px_var(--brand)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="w-5" />
        <span className="flex items-center gap-2">
          {opening ? <Spinner className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          Terminar servicio
        </span>
        <ChevronRightIcon className="h-5 w-5 opacity-70 transition group-hover:translate-x-0.5" />
      </button>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line/20 px-5 py-2.5 text-[13px] font-medium text-ink-50 transition hover:bg-line/10">
          {uploading ? <Spinner className="h-4 w-4" /> : <FileTextIcon className="h-4 w-4" />}
          Subir evidencia
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onUpload}
            disabled={uploading}
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
  );
};

// Tarjeta principal del dashboard del chofer: servicios en curso y proximos, con la accion
// principal (Terminar servicio) bien a la vista.
export const ServiciosActualesCard = ({ services, openingId, uploadingId, errors, onClose, onUpload }) => {
  const enServicio = services.some((s) => s.estado === "IN_CONSEGNA" || s.estado === "RITIRATO");

  return (
    <section className="glass-surface relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 top-2 h-40 w-72 text-accent-400 opacity-[0.3] [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:opacity-40"
      >
        <TruckArt className="h-full w-full" />
      </div>

      <div className="relative">
        <span
          className={clsx(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium",
            enServicio ? "bg-success-500/15 text-success-500" : "bg-line/10 text-ink-300"
          )}
        >
          <span className={clsx("h-2 w-2 rounded-full", enServicio ? "bg-success-500" : "bg-ink-400")} />
          {enServicio ? "En servicio" : services.length > 0 ? "Con servicios pendientes" : "Sin servicios"}
        </span>

        <h2 className="mt-3 text-[22px] font-semibold leading-tight text-ink-50">Mis servicios de hoy y proximos</h2>

        {services.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-300">No tienes servicios en curso ni pendientes.</p>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-line/10">
            {services.map((service) => (
              <div key={service.id} className="py-5 first:pt-0 last:pb-0">
                <ServiceBlock
                  service={service}
                  opening={openingId === service.id}
                  uploading={uploadingId === service.id}
                  error={errors[service.id]}
                  onClose={onClose(service.id)}
                  onUpload={onUpload(service.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
