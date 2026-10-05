import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseApiError } from "../lib/api";
import {
  getSpeedingSummaryRequest,
  listSpeedingEventsByDayRequest,
  listSpeedingEventsByVehicleRequest,
} from "../lib/vehicles.api";
import { AlertTriangleIcon, ChevronDownIcon, ClipboardListIcon, TruckIcon } from "./ui/icons";
import { SegmentedControl } from "./ui/SegmentedControl";
import { Spinner } from "./ui/Spinner";
import { StatTile } from "./ui/StatTile";

const VIEW_OPTIONS = [
  { value: "dia", label: "Por día" },
  { value: "vehiculo", label: "Por vehículo" },
];

const TIME_ZONE = "Europe/Rome";
const romeDay = (date) => new Date(date).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
const timeLabel = (value) =>
  new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const dateTimeLabel = (value) =>
  new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

// "YYYY-MM-DD" -> "Hoy · lunes 5 de octubre" / "Ayer · …" / "sábado 3 de octubre".
const dayLabel = (day) => {
  const text = new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const today = romeDay(new Date());
  const yesterday = romeDay(new Date(Date.now() - 86400000));
  if (day === today) return `Hoy · ${text}`;
  if (day === yesterday) return `Ayer · ${text}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Cuanto sobre el umbral va el exceso: naranja si es leve, rojo si es importante.
const severity = (speed, threshold) => (speed >= threshold + 10 ? "danger" : "warning");
const SEVERITY_TEXT = { danger: "text-danger-500", warning: "text-warning-500" };

const EventRow = ({ event, threshold, showDate }) => {
  const level = severity(event.speedKmh, threshold);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-line/[0.07] px-4 py-2.5 text-[13px] first:border-t-0">
      {showDate ? (
        <span className="text-ink-200">{dateTimeLabel(event.occurredAt)}</span>
      ) : (
        <>
          <span className="w-14 tabular-nums text-ink-300">{timeLabel(event.occurredAt)}</span>
          <span className="flex-1 font-semibold tracking-wide text-ink-50">{event.targa}</span>
        </>
      )}
      <span className={clsx("flex items-baseline gap-2 font-semibold", SEVERITY_TEXT[level])}>
        {Math.round(event.speedKmh)} km/h
        <span className="text-[11px] font-normal text-ink-400">
          +{Math.max(0, Math.round(event.speedKmh - threshold))} sobre el umbral
        </span>
      </span>
    </li>
  );
};

// Un acordeon: el encabezado siempre se ve (viene del resumen); el contenido se pide al
// abrirlo por primera vez y queda guardado, asi no se vuelve a consultar al cerrar/abrir.
const AccordionItem = ({ id, open, onToggle, title, subtitle, badge, badgeLevel, meta, state, threshold, showDate, onRetry }) => (
  <li className="glass-surface overflow-hidden rounded-2xl">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`speeding-${id}`}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-line/[0.04]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink-50">{title}</span>
        {subtitle && <span className="block truncate text-[12px] text-ink-400">{subtitle}</span>}
      </span>
      {meta && <span className="hidden text-[12px] text-ink-300 sm:block">{meta}</span>}
      <span
        className={clsx(
          "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1",
          badgeLevel === "danger"
            ? "bg-danger-500/20 text-danger-500 ring-danger-500/40"
            : "bg-warning-500/20 text-warning-500 ring-warning-500/40"
        )}
      >
        {badge}
      </span>
      <ChevronDownIcon className={clsx("h-4 w-4 shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
    </button>

    {open && (
      <div id={`speeding-${id}`} className="border-t border-line/10">
        {!state || state.status === "loading" ? (
          <div className="flex justify-center py-5">
            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
          </div>
        ) : state.status === "error" ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-danger-500">
            {state.message}
            <button type="button" onClick={onRetry} className="font-medium text-accent-400 hover:underline">
              Reintentar
            </button>
          </div>
        ) : (
          <ul>
            {state.events.map((event) => (
              <EventRow key={event.id} event={event} threshold={threshold} showDate={showDate} />
            ))}
          </ul>
        )}
      </div>
    )}
  </li>
);

// Registro de excesos de velocidad de Control de Flota. Para no cargar todo siempre, la
// pagina pide solo un resumen chico (por dia y por vehiculo); el detalle de cada
// acordeon se descarga unicamente cuando se abre.
export const SpeedingSection = () => {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("dia");
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [details, setDetails] = useState({});

  const loadSummary = useCallback(() => {
    setError("");
    return getSpeedingSummaryRequest()
      .then(setSummary)
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const refresh = () => {
    setSummary(null);
    setOpenKeys(new Set());
    setDetails({});
    loadSummary();
  };

  const loadDetail = (key, kind, value) => {
    setDetails((prev) => ({ ...prev, [key]: { status: "loading" } }));
    const request = kind === "dia" ? listSpeedingEventsByDayRequest(value) : listSpeedingEventsByVehicleRequest(value);
    request
      .then((events) => setDetails((prev) => ({ ...prev, [key]: { status: "ok", events } })))
      .catch((err) =>
        setDetails((prev) => ({ ...prev, [key]: { status: "error", message: parseApiError(err).message } }))
      );
  };

  const toggle = (key, kind, value) => {
    const opening = !openKeys.has(key);
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (opening) next.add(key);
      else next.delete(key);
      return next;
    });
    if (opening && !details[key]) loadDetail(key, kind, value);
  };

  const stats = useMemo(() => {
    if (!summary || summary.total === 0) return null;
    const top = summary.vehicles[0];
    const fastest = [...summary.vehicles].sort((a, b) => b.maxSpeedKmh - a.maxSpeedKmh)[0];
    return { top, fastest };
  }, [summary]);

  const threshold = summary?.thresholdKmh ?? 120;

  return (
    <section className="glass-surface rounded-2xl p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-50">Exceso de velocidad</h2>
          <p className="mt-1 max-w-xl text-[13px] text-ink-300">
            Se registra cuando un vehículo supera los {threshold} km/h; un exceso sostenido cuenta como un solo
            episodio. Abre un acordeón para ver su detalle: se carga solo cuando lo pides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
          <button
            type="button"
            onClick={refresh}
            className="rounded-full border border-line/10 px-3 py-1.5 text-[12px] font-medium text-ink-200 transition-colors hover:bg-line/10"
          >
            Actualizar
          </button>
        </div>
      </header>

      {error && <p className="mt-4 text-[13px] text-danger-500">{error}</p>}

      {summary === null && !error && (
        <div className="flex justify-center py-8">
          <Spinner className="h-5 w-5 border-line/20 border-t-line" />
        </div>
      )}

      {summary && summary.total === 0 && (
        <p className="mt-4 text-[13px] text-ink-300">Sin excesos registrados en los últimos {summary.retentionDays} días.</p>
      )}

      {summary && stats && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              icon={ClipboardListIcon}
              value={summary.total}
              label="Excesos registrados"
              detail={`Últimos ${summary.retentionDays} días`}
            />
            <StatTile
              icon={AlertTriangleIcon}
              tone="danger"
              value={`${Math.round(stats.fastest.maxSpeedKmh)} km/h`}
              label="Velocidad máxima"
              detail={stats.fastest.targa}
            />
            <StatTile
              icon={TruckIcon}
              tone="warning"
              value={stats.top.count}
              label="Vehículo con más excesos"
              detail={stats.top.targa}
            />
          </div>

          <ul className="mt-5 flex flex-col gap-2.5">
            {view === "dia"
              ? summary.days.map((d) => {
                  const key = `dia-${d.day}`;
                  return (
                    <AccordionItem
                      key={key}
                      id={key}
                      open={openKeys.has(key)}
                      onToggle={() => toggle(key, "dia", d.day)}
                      title={dayLabel(d.day)}
                      subtitle={`${d.vehicles} ${d.vehicles === 1 ? "vehículo" : "vehículos"} · máx. ${Math.round(d.maxSpeedKmh)} km/h`}
                      badge={`${d.count} ${d.count === 1 ? "exceso" : "excesos"}`}
                      badgeLevel={d.count >= 5 || severity(d.maxSpeedKmh, threshold) === "danger" ? "danger" : "warning"}
                      state={details[key]}
                      threshold={threshold}
                      showDate={false}
                      onRetry={() => loadDetail(key, "dia", d.day)}
                    />
                  );
                })
              : summary.vehicles.map((v) => {
                  const key = `veh-${v.vehicleId}`;
                  return (
                    <AccordionItem
                      key={key}
                      id={key}
                      open={openKeys.has(key)}
                      onToggle={() => toggle(key, "vehiculo", v.vehicleId)}
                      title={v.targa}
                      subtitle={`Último: ${dateTimeLabel(v.lastAt)} · máx. ${Math.round(v.maxSpeedKmh)} km/h`}
                      badge={`${v.count} ${v.count === 1 ? "exceso" : "excesos"}`}
                      badgeLevel={v.count >= 5 || severity(v.maxSpeedKmh, threshold) === "danger" ? "danger" : "warning"}
                      state={details[key]}
                      threshold={threshold}
                      showDate
                      onRetry={() => loadDetail(key, "vehiculo", v.vehicleId)}
                    />
                  );
                })}
          </ul>
        </>
      )}
    </section>
  );
};
