import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  BellIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  RouteIcon,
  SearchIcon,
  TruckIcon,
} from "../../components/ui/icons";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import { VehicleStatusBadge } from "../../components/ui/VehicleStatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import {
  GRUPO_LABELS,
  GRUPO_OPTIONS,
  TAGLIANDO_STATUS_LABELS,
  VEHICLE_AREA_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  getTagliandoStatus,
} from "../../lib/constants";
import { computeFleetKmUsage, computeVehicleDocumentAlerts, filterToPiazzaYDhlRoma } from "../../lib/dashboardStats";
import { listRecordsByMonthRequest } from "../../lib/records.api";
import { listVehiclesRequest, syncVehiclesFromVelocityFleetRequest } from "../../lib/vehicles.api";
import { setVehicleSearch, useVehicleSearch } from "../../lib/vehicleSearchStore";

const areaLabel = (value) => VEHICLE_AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
const centroLabel = (grupo) => (grupo ? GRUPO_LABELS[grupo] ?? grupo : "Sin grupo");
const fmtKm = (km) => Math.round(km).toLocaleString("es-AR");
const conductorLabel = (vehicle) => vehicle.conductores?.map((c) => c.nombre).join(", ") || "—";

const SORT_OPTIONS = [
  { value: "targa", label: "Matrícula" },
  { value: "km", label: "Kilómetros" },
  { value: "modelo", label: "Modelo" },
];
const VIEW_OPTIONS = [
  { value: "tabla", label: "Tabla" },
  { value: "tarjetas", label: "Tarjetas" },
];
const VIEW_STORAGE_KEY = "gt_vehicles_view";

// Tabla en escritorio; en celular arranca en tarjetas (seis columnas no entran).
const initialView = () => {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "tabla" || saved === "tarjetas") return saved;
  } catch {
    // sin almacenamiento disponible: se usa el valor por defecto
  }
  return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches ? "tarjetas" : "tabla";
};

// Miniatura rectangular del vehiculo (o el icono de camion si no hay foto cargada).
const VehicleThumb = ({ vehicle, className }) =>
  vehicle.imagenUrl ? (
    <img
      src={vehicle.imagenUrl}
      alt={vehicle.targa}
      loading="lazy"
      className={clsx("shrink-0 rounded-lg bg-line/5 object-cover", className)}
    />
  ) : (
    <div className={clsx("flex shrink-0 items-center justify-center rounded-lg bg-line/5 text-ink-400", className)}>
      <TruckIcon className="h-5 w-5" />
    </div>
  );

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

// Color solo cuando hay algo que decir: naranja/rojo apagados si el conteo es 0.
const KpiTile = ({ icon: Icon, value, label, detail, tone = "neutral" }) => (
  <div className="glass-surface flex items-center gap-3 rounded-2xl p-4">
    <span
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        tone === "success" && "bg-success-500/15 text-success-500 ring-1 ring-success-500/30",
        tone === "warning" && "bg-warning-500/15 text-warning-500 ring-1 ring-warning-500/30",
        tone === "danger" && "bg-danger-500/15 text-danger-500 ring-1 ring-danger-500/30",
        tone === "neutral" && "bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30"
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
    <div className="min-w-0">
      <div className="text-[26px] font-semibold leading-none tracking-tight text-ink-50">{value}</div>
      <div className="mt-1 text-[13px] leading-tight text-ink-200">{label}</div>
      {detail && <div className="mt-0.5 text-[12px] text-ink-400">{detail}</div>}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Vista de tarjetas (agrupada por centro, como antes)
// ---------------------------------------------------------------------------

const VehicleCard = ({ vehicle }) => {
  const location = useLocation();
  return (
    <Link to={`/vehiculos/${vehicle.id}`} state={{ backgroundLocation: location }} className="block">
      <GlassCard className="!rounded-2xl !p-4 transition-colors hover:bg-line/[0.06]">
        <div className="flex items-center gap-3">
          <VehicleThumb vehicle={vehicle} className="h-10 w-14" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-medium text-ink-50">{vehicle.modelo}</h2>
            <p className="truncate text-[12px] text-ink-300">{vehicle.targa}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-ink-400">{areaLabel(vehicle.area)}</span>
          <VehicleStatusBadge status={vehicle.estado} className="shrink-0 !px-2 !py-0.5 !text-[11px]" />
        </div>
      </GlassCard>
    </Link>
  );
};

// @container (no breakpoints de viewport): la grilla vive en una columna que no es el
// ancho completo, asi que las variantes @sm/@md/@xl miran el ancho real disponible.
const GroupSection = ({ title, members }) => (
  <div className="@container flex flex-col gap-3">
    <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-300">
      {title} <span className="text-ink-500">({members.length})</span>
    </h2>
    <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
      {members.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} />
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Vista de tabla
// ---------------------------------------------------------------------------

const VehicleTable = ({ vehicles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const open = (id) => navigate(`/vehiculos/${id}`, { state: { backgroundLocation: location } });

  return (
    <div className="glass-surface overflow-x-auto rounded-2xl">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <th className="py-3.5 pl-4 pr-2 font-medium">Vehículo</th>
            <th className="px-2 py-3.5 font-medium">Matrícula</th>
            <th className="px-2 py-3.5 font-medium">Centro</th>
            <th className="px-2 py-3.5 font-medium">Conductor</th>
            <th className="px-2 py-3.5 text-right font-medium">Km</th>
            <th className="py-3.5 pl-2 pr-4 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr
              key={vehicle.id}
              onClick={() => open(vehicle.id)}
              className="cursor-pointer border-t border-line/[0.07] transition-colors hover:bg-line/[0.04]"
            >
              <td className="py-3 pl-4 pr-2">
                <div className="flex items-center gap-3">
                  <VehicleThumb vehicle={vehicle} className="h-9 w-12" />
                  <div className="min-w-0 max-w-[170px]">
                    <Link
                      to={`/vehiculos/${vehicle.id}`}
                      state={{ backgroundLocation: location }}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate font-medium text-ink-50 hover:text-accent-400"
                    >
                      {vehicle.modelo}
                    </Link>
                    <span className="block truncate text-[12px] text-ink-400">{areaLabel(vehicle.area)}</span>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-2 py-3 font-medium text-ink-100">{vehicle.targa}</td>
              <td className="whitespace-nowrap px-2 py-3 text-ink-200">{centroLabel(vehicle.grupo)}</td>
              <td className="max-w-[140px] truncate px-2 py-3 text-ink-200" title={conductorLabel(vehicle)}>{conductorLabel(vehicle)}</td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums text-ink-100">
                {vehicle.kmActual != null ? fmtKm(vehicle.kmActual) : "—"}
              </td>
              <td className="py-3 pl-2 pr-4">
                <VehicleStatusBadge status={vehicle.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Columna derecha
// ---------------------------------------------------------------------------

const PanelShell = ({ icon: Icon, title, aside, children, className }) => (
  <section className={clsx("glass-surface rounded-2xl p-5", className)}>
    <header className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-ink-300" />
        <h2 className="text-[15px] font-semibold text-ink-50">{title}</h2>
      </div>
      {aside}
    </header>
    {children}
  </section>
);

const TONE_DOT = { danger: "bg-danger-500", warning: "bg-warning-500" };

const AttentionGroup = ({ title, count, items }) =>
  items.length === 0 ? null : (
    <div>
      <h3 className="mb-1.5 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-ink-400">
        {title}
        <span className="rounded-full bg-line/10 px-1.5 text-[11px] text-ink-200">{count}</span>
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              state={item.state}
              className="flex items-center gap-2.5 rounded-xl border border-line/[0.07] px-3 py-2.5 text-[13px] transition-colors hover:bg-line/[0.05]"
            >
              <span className={clsx("h-2 w-2 shrink-0 rounded-full", TONE_DOT[item.tone])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink-50">{item.title}</span>
                {item.detail && <span className="block truncate text-[12px] text-ink-400">{item.detail}</span>}
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-500" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

// Documentos por vencer (poliza / revision tecnica), Tagliando proximo o urgente y
// vehiculos que no estan disponibles - todo con lo que ya trae la lista de vehiculos.
const AttentionPanel = ({ vehicles }) => {
  const location = useLocation();
  const state = { backgroundLocation: location };

  const { documents, tagliando, unavailable } = useMemo(() => {
    const now = new Date();
    const documents = computeVehicleDocumentAlerts(vehicles).map((alert) => ({
      key: alert.id,
      to: alert.link,
      state,
      tone: new Date(alert.date) < now ? "danger" : "warning",
      title: alert.message,
    }));

    const tagliando = vehicles
      .map((v) => ({ vehicle: v, status: getTagliandoStatus(v.kmUltimoMantenimiento, v.kmActual) }))
      .filter((item) => item.status && item.status.level !== "ok")
      .sort((a, b) =>
        a.status.level !== b.status.level
          ? a.status.level === "urgente"
            ? -1
            : 1
          : a.status.restante - b.status.restante
      )
      .map(({ vehicle, status }) => ({
        key: `tagliando-${vehicle.id}`,
        to: `/vehiculos/${vehicle.id}`,
        state,
        tone: status.level === "urgente" ? "danger" : "warning",
        title: `${vehicle.targa} - ${vehicle.modelo}`,
        detail: `${TAGLIANDO_STATUS_LABELS[status.level]} - ${fmtKm(status.restante)} km restantes`,
      }));

    const unavailable = vehicles
      .filter((v) => v.estado !== "DISPONIBLE")
      .map((v) => ({
        key: `estado-${v.id}`,
        to: `/vehiculos/${v.id}`,
        state,
        tone: v.estado === "FUERA_DE_SERVICIO" ? "danger" : "warning",
        title: `${v.targa} - ${v.modelo}`,
        detail: v.estado === "FUERA_DE_SERVICIO" ? "Fuera de servicio" : "En mantenimiento",
      }));

    return { documents, tagliando, unavailable };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  const total = documents.length + tagliando.length + unavailable.length;

  return (
    <PanelShell
      icon={BellIcon}
      title="Atención requerida"
      aside={
        total > 0 ? (
          <span className="rounded-full bg-warning-500/10 px-2 py-0.5 text-[12px] font-medium text-warning-500">
            {total}
          </span>
        ) : null
      }
    >
      {total === 0 ? (
        <p className="flex items-center gap-2 py-2 text-[13px] text-ink-300">
          <CheckCircleIcon className="h-5 w-5 text-success-500" />
          Todo en orden: ningún vehículo necesita atención.
        </p>
      ) : (
        <div className="flex max-h-[300px] flex-col gap-4 overflow-y-auto pr-1">
          <AttentionGroup title="Documentos" count={documents.length} items={documents} />
          <AttentionGroup title="Tagliando" count={tagliando.length} items={tagliando} />
          <AttentionGroup title="Estado de la flota" count={unavailable.length} items={unavailable} />
        </div>
      )}
    </PanelShell>
  );
};

// Cuantos vehiculos hay en cada centro y como se reparten por estado.
const CenterSummaryPanel = ({ vehicles }) => {
  const centers = [...GRUPO_OPTIONS.map((g) => g.value), null]
    .map((grupo) => {
      const members = vehicles.filter((v) => (v.grupo ?? null) === grupo);
      return {
        grupo,
        label: centroLabel(grupo),
        total: members.length,
        disponibles: members.filter((v) => v.estado === "DISPONIBLE").length,
        mantenimiento: members.filter((v) => v.estado === "EN_MANTENIMIENTO").length,
        fuera: members.filter((v) => v.estado === "FUERA_DE_SERVICIO").length,
      };
    })
    .filter((c) => c.total > 0);

  return (
    <PanelShell icon={MapPinIcon} title="Resumen por centro">
      <ul className="flex flex-col gap-2.5">
        {centers.map((c) => (
          <li key={c.label} className="rounded-xl border border-line/[0.07] px-3.5 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-ink-50">{c.label}</span>
              <span className="text-[12px] text-ink-400">
                {c.total} {c.total === 1 ? "vehículo" : "vehículos"}
              </span>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line/10">
              <span className="bg-success-500" style={{ width: `${(c.disponibles / c.total) * 100}%` }} />
              <span className="bg-warning-500" style={{ width: `${(c.mantenimiento / c.total) * 100}%` }} />
              <span className="bg-danger-500" style={{ width: `${(c.fuera / c.total) * 100}%` }} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                {c.disponibles}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
                {c.mantenimiento}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
                {c.fuera}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
};

// Suma de los km del mes en curso (real si ya se cargo, si no el planificado); los
// servicios anulados no cuentan. Usa los mismos registros del mes que el ranking.
const KmMonthPanel = ({ records }) => {
  const total = records
    ? records
        .filter((r) => r.estado !== "ANNULLATO")
        .reduce((sum, r) => sum + (r.kilometrosReales ?? r.kilometros ?? 0), 0)
    : null;
  const monthName = new Date().toLocaleDateString("es-AR", { month: "long" });

  return (
    <PanelShell icon={RouteIcon} title="Kilómetros del mes">
      {total === null ? (
        <div className="flex justify-center py-4">
          <Spinner className="h-5 w-5 border-line/20 border-t-line" />
        </div>
      ) : (
        <>
          <div className="text-[30px] font-semibold leading-none tracking-tight text-ink-50">
            {fmtKm(total)} km
          </div>
          <p className="mt-2 text-[12px] text-ink-400">Recorridos en {monthName}</p>
        </>
      )}
    </PanelShell>
  );
};

const KM_BREAKDOWN_ROWS = [
  { key: "EXTRA_PIAZZA", label: "Extras Piazza", multiplier: 1 },
  { key: "DHL", label: "DHL", multiplier: 2 },
  { key: "AB_SERVICE", label: "AB Service", multiplier: 2 },
];

// Desglose de KM del mes por tipo de servicio, con el x2 de DHL/AB Service
// visible por separado (ver kmMultiplier en dashboardStats.js) en vez de solo
// el total ya ponderado.
const VehicleKmModal = ({ entry, onClose }) => {
  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />
      <div className="glass-surface relative z-10 w-full max-w-sm rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">{entry.nombre}</h2>
        <p className="mt-1 text-[13px] text-ink-400">KM recorridos este mes, por tipo de servicio.</p>

        <div className="mt-4 flex flex-col gap-2">
          {KM_BREAKDOWN_ROWS.map(({ key, label, multiplier }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl glass-surface-sm px-3 py-2 text-[13px]"
            >
              <span className="text-ink-50">{label}</span>
              <span className="text-ink-300">
                {fmtKm(entry.breakdown[key])} km{multiplier > 1 ? ` x2 = ${fmtKm(entry.breakdown[key] * multiplier)} km` : ""}
              </span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between rounded-xl bg-line/5 px-3 py-2 text-[13px] font-medium">
            <span className="text-ink-50">Total</span>
            <span className="text-ink-50">{fmtKm(entry.km)} km</span>
          </div>
        </div>

        <Button variant="ghost" className="mt-6" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>,
    document.body
  );
};

// Top de vehiculos por KM recorrido este mes (planificado o real, ver
// computeFleetKmUsage). Acotado a Piazza + DHL Roma (ver filterToPiazzaYDhlRoma),
// mismo criterio que el resto de la app.
const FleetRankingPanel = ({ records }) => {
  const ranking = records ? computeFleetKmUsage(filterToPiazzaYDhlRoma(records), "mes").slice(0, 10) : undefined;
  const [selectedEntry, setSelectedEntry] = useState(null);

  return (
    <PanelShell icon={TruckIcon} title="Ranking de flota">
      <p className="-mt-1 mb-3 text-[12px] text-ink-400">Km recorridos este mes, de mayor a menor.</p>

      <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-1">
        {ranking === undefined && (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
          </div>
        )}
        {ranking?.length === 0 && (
          <p className="py-3 text-center text-[13px] text-ink-300">Sin servicios este mes todavía.</p>
        )}
        {ranking?.map((entry, idx) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setSelectedEntry(entry)}
            className="flex items-center gap-3 rounded-xl border border-line/[0.07] px-3 py-2 text-left text-[13px] transition-colors hover:bg-line/[0.05]"
          >
            <span className="w-4 shrink-0 text-center text-[12px] font-medium text-ink-400">{idx + 1}</span>
            <span className="min-w-0 flex-1 truncate text-ink-50">{entry.nombre}</span>
            <span className="shrink-0 text-[12px] text-ink-300">{fmtKm(entry.km)} km</span>
          </button>
        ))}
      </div>

      {selectedEntry && <VehicleKmModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </PanelShell>
  );
};

// ---------------------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------------------

const PAGE_SIZE_TABLE = 10;
const PAGE_SIZE_CARDS = 9;

// Numeros de pagina a mostrar: todos si son pocos; si no, primera, ultima y las
// vecinas de la actual con "…" en los saltos.
const pageNumbers = (current, count) => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["…", p] : [p]));
};

const Pagination = ({ page, pageCount, from, to, total, onChange }) => {
  const arrow =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-line/10 text-ink-200 transition-colors enabled:hover:bg-line/10 disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-ink-400">
        Mostrando {from} - {to} de {total} vehículos
      </p>
      {pageCount > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-1.5">
          <button type="button" className={arrow} disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          {pageNumbers(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-ink-500">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={clsx(
                  "h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium transition-colors",
                  p === page
                    ? "bg-accent-500 text-white"
                    : "border border-line/10 text-ink-200 hover:bg-line/10"
                )}
              >
                {p}
              </button>
            )
          )}
          <button type="button" className={arrow} disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label="Página siguiente">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
};

const todosOption = (label, options) => [{ value: "", label }, ...options];

export const VehiclesPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const { version: vehiclesVersion, refresh: refreshVehicles } = useDataRefresh("vehicles");
  const { version: recordsVersion } = useDataRefresh("records");

  const [vehicles, setVehicles] = useState(null);
  const [monthlyRecords, setMonthlyRecords] = useState(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const [view, setView] = useState(initialView);
  const [centro, setCentro] = useState("");
  const [area, setArea] = useState("");
  const [estado, setEstado] = useState("");
  const [sort, setSort] = useState("targa");
  const [page, setPage] = useState(1);

  // La barra superior y la de la pagina comparten el mismo texto (ver vehicleSearchStore).
  const query = useVehicleSearch();
  const setQuery = setVehicleSearch;

  // Al salir de Vehiculos se limpia la busqueda.
  useEffect(() => () => setVehicleSearch(""), []);

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // sin almacenamiento disponible: la vista solo dura esta sesion
    }
  };

  useEffect(() => {
    if (!isPrivileged) return;
    listVehiclesRequest()
      .then(setVehicles)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged, vehiclesVersion]);

  // Depende tambien de recordsVersion: el uso de flota/ranking sale de los registros
  // del mes, no de los vehiculos - si se edita un km desde el detalle de un registro,
  // esto tiene que reflejarse aca tambien.
  useEffect(() => {
    if (!isPrivileged) return;
    const now = new Date();
    listRecordsByMonthRequest(now.getFullYear(), now.getMonth() + 1)
      .then(setMonthlyRecords)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged, recordsVersion]);

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    const needle = query.trim().toLowerCase();

    const list = vehicles.filter((v) => {
      if (centro && (centro === "SIN_GRUPO" ? v.grupo : v.grupo !== centro)) return false;
      if (area && v.area !== area) return false;
      if (estado && v.estado !== estado) return false;
      if (!needle) return true;
      const haystack = [v.targa, v.modelo, centroLabel(v.grupo), areaLabel(v.area), conductorLabel(v)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    return [...list].sort((a, b) => {
      if (sort === "km") return (b.kmActual ?? -1) - (a.kmActual ?? -1);
      if (sort === "modelo") return a.modelo.localeCompare(b.modelo, "es");
      return a.targa.localeCompare(b.targa, "es");
    });
  }, [vehicles, query, centro, area, estado, sort]);

  // Tramo visible: la tabla muestra 10 por pagina, las tarjetas 9 (grilla de 3 columnas).
  const pageSize = view === "tabla" ? PAGE_SIZE_TABLE : PAGE_SIZE_CARDS;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Al cambiar busqueda, filtros, orden o vista se vuelve a la primera pagina.
  useEffect(() => {
    setPage(1);
  }, [query, centro, area, estado, sort, view]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const hasFilters = Boolean(query.trim() || centro || area || estado);
  const total = vehicles?.length ?? 0;
  const count = (status) => vehicles?.filter((v) => v.estado === status).length ?? 0;
  const disponibles = count("DISPONIBLE");
  const mantenimiento = count("EN_MANTENIMIENTO");
  const fuera = count("FUERA_DE_SERVICIO");
  const pct = (n) => (total > 0 ? `${Math.round((n / total) * 100)}% de la flota` : "");

  // Importa a demanda las targas que Velocity Fleet reporte y todavia no tengan
  // ficha (se crean con area "Sin asignar" para revisar despues) - solo OWNER, mismo
  // criterio que el backend.
  const handleSyncFromVelocity = async () => {
    setSyncing(true);
    setError("");
    setSyncMessage("");
    try {
      const result = await syncVehiclesFromVelocityFleetRequest();
      setSyncMessage(
        result.createdCount === 0
          ? "No hay targas nuevas para importar."
          : `Se importaron ${result.createdCount} vehículo(s): ${result.created
              .map((v) => v.targa)
              .join(", ")}. Revisa su área/modelo en la ficha de cada uno.`
      );
      refreshVehicles();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSyncing(false);
    }
  };

  const groups = [...GRUPO_OPTIONS.map((g) => ({ value: g.value, title: g.label })), { value: null, title: "Sin grupo" }]
    .map((g) => ({ ...g, members: pageItems.filter((v) => (v.grupo ?? null) === g.value) }))
    .filter((g) => g.members.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Vehículos</h1>
          <p className="mt-1 text-[14px] text-ink-300">Gestiona y monitorea tu flota en tiempo real.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.cargo === "OWNER" && (
            <Button variant="ghost" className="!w-auto px-5" onClick={handleSyncFromVelocity} loading={syncing}>
              Importar de Velocity Fleet
            </Button>
          )}
          <Link to="/vehiculos/new" state={{ backgroundLocation: location }}>
            <Button className="!w-auto px-5">+ Nuevo vehículo</Button>
          </Link>
        </div>
      </div>

      {syncMessage && <Alert variant="success">{syncMessage}</Alert>}

      <Alert>{error}</Alert>

      {vehicles === null && !error && <PageLoader />}

      {vehicles?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">Todavía no hay vehículos cargados.</GlassCard>
      )}

      {vehicles !== null && vehicles.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <KpiTile icon={TruckIcon} value={total} label="Total de vehículos" />
              <KpiTile
                icon={CheckCircleIcon}
                tone="success"
                value={disponibles}
                label="Disponibles"
                detail={pct(disponibles)}
              />
              <KpiTile
                icon={AlertTriangleIcon}
                tone={mantenimiento > 0 ? "warning" : "neutral"}
                value={mantenimiento}
                label="En mantenimiento"
                detail={pct(mantenimiento)}
              />
              <KpiTile
                icon={AlertCircleIcon}
                tone={fuera > 0 ? "danger" : "neutral"}
                value={fuera}
                label="Fuera de servicio"
                detail={pct(fuera)}
              />
            </div>

            <div className="glass-surface grid grid-cols-2 gap-3 rounded-2xl p-4 md:grid-cols-4">
              <TextField
                id="vehicles-search"
                icon={SearchIcon}
                type="search"
                placeholder="Buscar vehículo, matrícula, conductor..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="col-span-2 md:col-span-4"
              />
              <Select
                id="vehicles-centro"
                label="Centro"
                value={centro}
                onChange={(e) => setCentro(e.target.value)}
                options={todosOption("Todos", [
                  ...GRUPO_OPTIONS.map((g) => ({ value: g.value, label: g.label })),
                  { value: "SIN_GRUPO", label: "Sin grupo" },
                ])}
              />
              <Select
                id="vehicles-area"
                label="Área"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                options={todosOption("Todas", VEHICLE_AREA_OPTIONS)}
              />
              <Select
                id="vehicles-estado"
                label="Estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                options={todosOption("Todos", VEHICLE_STATUS_OPTIONS)}
              />
              <Select
                id="vehicles-sort"
                label="Ordenar por"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                options={SORT_OPTIONS}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-ink-400">
                {hasFilters ? `${filtered.length} de ${total} vehículos coinciden` : `${total} vehículos en la flota`}
              </p>
              <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} />
            </div>

            {filtered.length === 0 ? (
              <GlassCard className="text-center text-[14px] text-ink-300">
                Ningún vehículo coincide con los filtros.
              </GlassCard>
            ) : view === "tabla" ? (
              <VehicleTable vehicles={pageItems} />
            ) : (
              <div className="flex flex-col gap-7">
                {groups.map((g) => (
                  <GroupSection key={g.title} title={g.title} members={g.members} />
                ))}
              </div>
            )}
            {filtered.length > 0 && (
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                from={(currentPage - 1) * pageSize + 1}
                to={Math.min(currentPage * pageSize, filtered.length)}
                total={filtered.length}
                onChange={setPage}
              />
            )}
            {hasFilters && filtered.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCentro("");
                  setArea("");
                  setEstado("");
                  setQuery("");
                }}
                className="self-start text-[13px] font-medium text-accent-400 hover:text-accent-300"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <aside className="flex flex-col gap-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:pr-1">
            <AttentionPanel vehicles={vehicles} />
            <CenterSummaryPanel vehicles={vehicles} />
            <KmMonthPanel records={monthlyRecords} />
            <FleetRankingPanel records={monthlyRecords} />
          </aside>
        </div>
      )}
    </div>
  );
};
