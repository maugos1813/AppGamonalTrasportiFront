import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MancatoBadge } from "../../components/mancato/MancatoBadge";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { MancatoSidebar } from "../../components/mancato/MancatoSidebar";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  DotsIcon,
  EuroIcon,
  FileTextIcon,
  FilterIcon,
  PlusIcon,
  ReceiptIcon,
  RefreshIcon,
  SearchIcon,
  UsersIcon,
} from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import { MANCATO_ESTADOS } from "../../lib/mancato";
import {
  getMancatoStatsRequest,
  getMancatoSummaryRequest,
  listMancatosRequest,
  updateMancatoRequest,
} from "../../lib/mancato.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const PAGE_SIZE = 20;

const EMPTY_FILTERS = {
  estado: "",
  driverId: "",
  targa: "",
  from: "",
  to: "",
  fueraDePlazo: false,
  q: "",
  orden: "",
};

const ORDEN_OPTIONS = [
  { value: "", label: "Mas urgentes" },
  { value: "recientes", label: "Mas recientes" },
  { value: "antiguos", label: "Mas antiguos" },
  { value: "monto", label: "Mayor monto" },
];

const AVATAR_COLORS = ["#ff3b57", "#ff8a1a", "#2f8dff", "#a78bfa", "#22d3ee"];
const avatarColor = (name) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

// Espera a que se deje de tipear/cambiar antes de pegarle al backend.
const useDebounced = (value, ms) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timeoutId);
  }, [value, ms]);
  return debounced;
};

// Columnas de la tabla (escritorio). El chofer no ve la columna "Chofer": todo es suyo.
const gridCols = (showDriver) =>
  showDriver
    ? "lg:grid-cols-[116px_minmax(0,1.25fr)_minmax(0,1.1fr)_96px_110px_132px_36px]"
    : "lg:grid-cols-[116px_minmax(0,1.2fr)_96px_110px_132px_36px]";

const plazoParts = (m) => {
  if (m.estado === "PAGADO") {
    return {
      top: m.pagadoAt ? `Pagado ${formatDateOnly(m.pagadoAt)}` : "Pagado",
      bottom: m.pagadoFueraDePlazo ? "fuera de plazo" : "a tiempo",
      tone: m.pagadoFueraDePlazo ? "text-warning-500" : "text-success-500",
    };
  }
  const dias = m.diasRestantes;
  const top = `Vence ${formatDateOnly(m.fechaVencimiento)}`;
  if (dias < 0) {
    return { top, bottom: `hace ${-dias} ${-dias === 1 ? "dia" : "dias"}`, tone: "text-danger-500" };
  }
  if (dias === 0) return { top, bottom: "hoy", tone: "text-danger-500" };
  return { top, bottom: `en ${dias} ${dias === 1 ? "dia" : "dias"}`, tone: dias <= 3 ? "text-warning-500" : "text-ink-400" };
};

// Menu "..." de cada fila: acciones rapidas sin abrir el detalle.
const RowMenu = ({ mancato, isPrivileged, location, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const togglePagado = async () => {
    setBusy(true);
    try {
      await updateMancatoRequest(mancato.id, { pagado: String(!mancato.pagado) });
      onChanged();
    } catch {
      // El detalle muestra el error con mas contexto; aca solo se cierra el menu.
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-50 transition-colors hover:bg-line/10";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Acciones"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <DotsIcon className="h-5 w-5" />}
      </button>
      {open && (
        <div className="glass-surface absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-xl bg-background py-1 shadow-xl">
          <Link
            to={`/mancato-pagamento/${mancato.id}`}
            state={{ backgroundLocation: location }}
            className={itemClass}
          >
            Ver detalle
          </Link>
          {mancato.sitioWeb && !mancato.pagado && (
            <a href={mancato.sitioWeb} target="_blank" rel="noreferrer noopener" className={itemClass}>
              Pagar en el sitio web
            </a>
          )}
          {isPrivileged && (
            <button type="button" onClick={togglePagado} disabled={busy} className={itemClass}>
              {mancato.pagado ? "Reabrir (marcar pendiente)" : "Marcar como pagado"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MancatoRow = ({ mancato, showDriver, vehicle, location, isPrivileged, onChanged }) => {
  const estado = MANCATO_ESTADOS.find((e) => e.value === mancato.estado);
  const plazo = plazoParts(mancato);
  const driverName = mancato.driver ? `${mancato.driver.nombre} ${mancato.driver.apellido}` : "Sin chofer";

  return (
    <div className="relative">
      <Link
        to={`/mancato-pagamento/${mancato.id}`}
        state={{ backgroundLocation: location }}
        className={clsx(
          "grid grid-cols-1 gap-2 rounded-xl border-l-4 px-4 py-3 pr-14 transition-colors hover:bg-line/[0.07] lg:items-center lg:gap-3",
          estado.edge,
          gridCols(showDriver),
          "lg:rounded-lg lg:border-l-0 lg:border-b lg:border-b-line/10 lg:py-2.5 lg:pr-4"
        )}
      >
        {/* Fecha + numero */}
        <div className="min-w-0">
          <span className="block text-[13px] font-medium text-ink-50">{formatDateOnly(mancato.fecha)}</span>
          <span className="block truncate text-[12px] text-ink-400">#{mancato.numero}</span>
        </div>

        {/* Chofer */}
        {showDriver && (
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(driverName) }}
            >
              {initials(driverName)}
            </span>
            <div className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink-50">{driverName}</span>
              {mancato.fueraDePlazo && (
                <span className="block text-[11px] font-medium text-danger-500">Fuera de plazo</span>
              )}
            </div>
          </div>
        )}

        {/* Vehiculo */}
        <div className="min-w-0">
          <span className="block truncate text-[13px] text-ink-50">{vehicle?.modelo ?? "-"}</span>
          <span className="block text-[12px] text-ink-400 underline decoration-ink-500/50 underline-offset-2">
            {mancato.targa}
          </span>
          {!showDriver && mancato.fueraDePlazo && (
            <span className="block text-[11px] font-medium text-danger-500">Fuera de plazo</span>
          )}
        </div>

        {/* Monto */}
        <span className="text-[14px] font-semibold text-ink-50 lg:pr-3 lg:text-right">{formatCurrency(mancato.costo)}</span>

        {/* Estado */}
        <div>
          <MancatoBadge mancato={mancato} />
        </div>

        {/* Plazo */}
        <div className="min-w-0">
          <span className="block text-[13px] text-ink-50">{plazo.top}</span>
          <span className={clsx("block text-[12px] font-medium", plazo.tone)}>{plazo.bottom}</span>
        </div>

        <span className="hidden lg:block" aria-hidden="true" />
      </Link>

      <div className="absolute right-3 top-3 lg:inset-y-0 lg:flex lg:items-center">
        <RowMenu mancato={mancato} isPrivileged={isPrivileged} location={location} onChanged={onChanged} />
      </div>
    </div>
  );
};

// Acordeon de un estado: el encabezado muestra cantidad y total (viene del resumen, sin
// traer filas); la tabla se pide recien al abrirlo y de a PAGE_SIZE.
const EstadoAccordion = ({
  estado,
  summary,
  params,
  version,
  defaultOpen,
  showDriver,
  vehiclesByTarga,
  location,
  isPrivileged,
  onChanged,
}) => {
  const info = MANCATO_ESTADOS.find((e) => e.value === estado);
  // Mientras el usuario no lo toque, abre o cierra solo segun haya resultados; si lo toca,
  // se respeta su eleccion.
  const [userOpen, setUserOpen] = useState(null);
  const open = userOpen ?? defaultOpen;
  const [list, setList] = useState({ items: null, total: 0, page: 1, loading: false, error: "" });
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!open) {
      setList((prev) => (prev.items ? { ...prev, items: null } : prev));
      return undefined;
    }
    let cancelled = false;
    setList((prev) => ({ ...prev, loading: true, error: "" }));
    listMancatosRequest({ ...params, estado, page: 1, pageSize: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) {
          setList({ items: data.items, total: data.total, page: 1, loading: false, error: "" });
        }
      })
      .catch((err) => {
        if (!cancelled) setList((prev) => ({ ...prev, loading: false, error: parseApiError(err).message }));
      });
    return () => {
      cancelled = true;
    };
    // paramsKey resume params: evita re-pedir por un objeto nuevo con el mismo contenido.
  }, [open, paramsKey, version, estado]);

  const loadMore = async () => {
    const nextPage = list.page + 1;
    setList((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await listMancatosRequest({ ...params, estado, page: nextPage, pageSize: PAGE_SIZE });
      setList((prev) => ({
        items: [...(prev.items ?? []), ...data.items],
        total: data.total,
        page: nextPage,
        loading: false,
        error: "",
      }));
    } catch (err) {
      setList((prev) => ({ ...prev, loading: false, error: parseApiError(err).message }));
    }
  };

  const remaining = list.items ? list.total - list.items.length : 0;
  const headerClass = "text-[11px] font-medium uppercase tracking-wide text-ink-400";

  // focus-within: la seccion con un menu abierto sube por encima de las de abajo.
  return (
    <section className={clsx("glass-surface relative rounded-2xl border-l-4 focus-within:z-20", info.edge)}>
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        className={clsx(
          "flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-line/[0.05]",
          open ? "rounded-t-2xl" : "rounded-2xl"
        )}
      >
        <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", info.dot)} />
        <span className="text-[16px] font-semibold text-ink-50">{info.plural}</span>
        <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", info.pill)}>
          {summary.count}
        </span>
        <span className="ml-auto text-[15px] font-semibold text-ink-50">{formatCurrency(summary.total)}</span>
        <ChevronDownIcon
          className={clsx("h-5 w-5 shrink-0 text-ink-300 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-line/10 px-2 pb-3 pt-1 sm:px-3">
          <Alert>{list.error}</Alert>

          {list.items === null && list.loading && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}

          {list.items?.length === 0 && (
            <p className="px-3 py-4 text-[14px] text-ink-400">
              No hay mancato pagamento {info.label.toLowerCase()}.
            </p>
          )}

          {list.items?.length > 0 && (
            <>
              <div className={clsx("hidden gap-3 px-4 py-2 lg:grid", gridCols(showDriver))}>
                <span className={headerClass}>Fecha</span>
                {showDriver && <span className={headerClass}>Chofer</span>}
                <span className={headerClass}>Vehiculo</span>
                <span className={clsx(headerClass, "lg:pr-3 text-right")}>Monto</span>
                <span className={headerClass}>Estado</span>
                <span className={headerClass}>Plazo</span>
                <span />
              </div>

              <div className="flex flex-col gap-2 lg:gap-0">
                {list.items.map((mancato) => (
                  <MancatoRow
                    key={mancato.id}
                    mancato={mancato}
                    showDriver={showDriver}
                    vehicle={vehiclesByTarga.get(mancato.targa)}
                    location={location}
                    isPrivileged={isPrivileged}
                    onChanged={onChanged}
                  />
                ))}
              </div>

              <div className="mt-2 flex flex-col items-center justify-between gap-2 px-3 sm:flex-row">
                <span className="text-[12px] text-ink-400">
                  Mostrando {list.items.length} de {list.total}{" "}
                  {list.total === 1 ? "aviso" : "avisos"}
                </span>
                {remaining > 0 && (
                  <Button
                    variant="ghost"
                    className="py-2 text-[13px] sm:w-auto sm:px-5"
                    loading={list.loading}
                    onClick={loadMore}
                  >
                    Ver mas ({remaining} restantes)
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export const MancatoPagamentoPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const { version, refresh } = useDataRefresh("mancato");

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // En celular arrancan cerrados (ocupan media pantalla); en escritorio, abiertos.
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth >= 1024);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listVehiclesRequest().then(setVehicles).catch(() => {});
    if (isPrivileged) {
      listUsersRequest()
        .then((users) => setDrivers(users.filter((u) => u.estado === "ACTIVO")))
        .catch(() => {});
    }
  }, [isPrivileged]);

  const vehiclesByTarga = useMemo(
    () => new Map(vehicles.map((v) => [v.targa.replace(/\s+/g, "").toUpperCase(), v])),
    [vehicles]
  );

  const setFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  // Los filtros que mueven numeros (resumen, KPIs, grafico). El estado y el orden solo
  // cambian que acordeones se ven y como se ordenan las filas.
  const rawParams = useMemo(
    () => ({
      q: filters.q.trim() || undefined,
      driverId: filters.driverId || undefined,
      targa: filters.targa.trim() || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      fueraDePlazo: filters.fueraDePlazo ? "true" : undefined,
    }),
    [filters.q, filters.driverId, filters.targa, filters.from, filters.to, filters.fueraDePlazo]
  );
  const params = useDebounced(rawParams, 350);
  const paramsKey = JSON.stringify(params);
  const listParams = useMemo(() => ({ ...params, orden: filters.orden || undefined }), [params, filters.orden]);

  const activeFilterCount =
    Object.values(params).filter(Boolean).length + (filters.estado ? 1 : 0) + (filters.orden ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMancatoSummaryRequest(params), getMancatoStatsRequest(params)])
      .then(([summaryData, statsData]) => {
        if (!cancelled) {
          setSummary(summaryData);
          setStats(statsData);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
    // paramsKey resume params (ver arriba).
  }, [paramsKey, version]);

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const visibleEstados = MANCATO_ESTADOS.filter((e) => !filters.estado || e.value === filters.estado);
  const driverOptions = [
    { value: "", label: "Todos" },
    ...drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` })),
  ];
  const estadoOptions = [
    { value: "", label: "Todos" },
    ...MANCATO_ESTADOS.map((e) => ({ value: e.value, label: e.label })),
  ];

  const antiguedad = stats ? Math.round(stats.antiguedadMediaDias) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-500/15 text-danger-500 ring-1 ring-danger-500/30">
            <ReceiptIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[26px] font-semibold leading-tight text-ink-50">Mancato Pagamento</h1>
            <p className="mt-0.5 text-[14px] text-ink-300">
              {isPrivileged
                ? "Controla los avisos de pago omitido de toda la flota. Cada uno se puede pagar hasta el dia 15 posterior a su fecha."
                : "Tus avisos de pago omitido. Cada uno se puede pagar hasta el dia 15 posterior a su fecha."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="glass-surface-sm flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-300">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <input
              type="date"
              aria-label="Fecha desde"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => setFilter("from", e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-ink-50 outline-none"
            />
            <span>-</span>
            <input
              type="date"
              aria-label="Fecha hasta"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => setFilter("to", e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-ink-50 outline-none"
            />
          </div>
          <Link to="/mancato-pagamento/new" state={{ backgroundLocation: location }}>
            <Button className="w-full sm:w-auto sm:px-6">
              <PlusIcon className="h-4 w-4" />
              Nuevo registro
            </Button>
          </Link>
        </div>
      </div>

      <Alert>{error}</Alert>
      {!summary && !error && <PageLoader />}

      {summary && stats && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            {/* Indicadores */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
              <MancatoKpi
                icon={EuroIcon}
                label="Total por pagar"
                value={formatCurrency(stats.totalPorPagar)}
                deltaPct={stats.totalPorPagarDeltaPct}
                deltaLabel="vs. mes anterior"
                detail="Vencidos y pendientes"
                color="#ff3b57"
              />
              <MancatoKpi
                icon={FileTextIcon}
                label="Avisos por pagar"
                value={stats.avisosAbiertos}
                detail={`de ${stats.avisosTotales} totales`}
                color="#ff8a1a"
              />
              {isPrivileged ? (
                <MancatoKpi
                  icon={UsersIcon}
                  label="Choferes con deuda"
                  value={stats.choferesConDeuda}
                  detail={`de ${stats.totalChoferes ?? 0} choferes`}
                  color="#a78bfa"
                />
              ) : (
                <MancatoKpi
                  icon={UsersIcon}
                  label="Vencen en 3 dias"
                  value={stats.recomendacion.porVencer3Dias}
                  detail="Pagalos a tiempo"
                  color="#a78bfa"
                />
              )}
              <MancatoKpi
                icon={ClockIcon}
                label="Antiguedad media"
                value={`${antiguedad} ${antiguedad === 1 ? "dia" : "dias"}`}
                deltaPct={stats.antiguedadMediaDeltaPct}
                deltaLabel="vs. mes anterior"
                detail="Desde la fecha del aviso"
                color="#22d3ee"
              />
            </div>

            {/* Filtros */}
            <div className="glass-surface-sm rounded-2xl p-4">
              <div className={clsx("flex items-center justify-between gap-3", filtersOpen && "mb-3")}>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  aria-expanded={filtersOpen}
                  className="flex items-center gap-2 text-[13px] font-medium text-ink-300 hover:text-ink-50"
                >
                  <FilterIcon className="h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-[11px] font-semibold text-accent-300">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDownIcon className={clsx("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 rounded-lg glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                    Limpiar filtros
                  </button>
                )}
              </div>

              <div className={clsx("flex flex-wrap items-end gap-3", !filtersOpen && "hidden")}>
                <TextField
                  id="filtro-q"
                  label="Buscar"
                  icon={SearchIcon}
                  placeholder="Numero, targa, chofer o comentario"
                  value={filters.q}
                  onChange={(e) => setFilter("q", e.target.value)}
                  className="min-w-[240px] flex-[2_1_260px]"
                />
                <div className="min-w-[150px] flex-[1_1_150px]">
                  <Select
                    id="filtro-estado"
                    label="Estado"
                    options={estadoOptions}
                    value={filters.estado}
                    onChange={(e) => setFilter("estado", e.target.value)}
                  />
                </div>
                {isPrivileged && (
                  <div className="min-w-[170px] flex-[1_1_170px]">
                    <Select
                      id="filtro-chofer"
                      label="Chofer"
                      options={driverOptions}
                      value={filters.driverId}
                      onChange={(e) => setFilter("driverId", e.target.value)}
                    />
                  </div>
                )}
                <div className="min-w-[130px] flex-[1_1_130px]">
                  <TextField
                    id="filtro-targa"
                    label="Targa"
                    placeholder="Ej. AB123CD"
                    list="mancato-filtro-targas"
                    autoComplete="off"
                    value={filters.targa}
                    onChange={(e) => setFilter("targa", e.target.value.toUpperCase())}
                  />
                  <datalist id="mancato-filtro-targas">
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.targa} />
                    ))}
                  </datalist>
                </div>
                <div className="min-w-[150px] flex-[1_1_150px]">
                  <Select
                    id="filtro-orden"
                    label="Ordenar por"
                    options={ORDEN_OPTIONS}
                    value={filters.orden}
                    onChange={(e) => setFilter("orden", e.target.value)}
                  />
                </div>
                <label className="flex min-w-[210px] flex-[1_1_210px] cursor-pointer items-center gap-2.5 rounded-xl glass-input px-4 py-3 text-[14px] text-ink-50">
                  <input
                    type="checkbox"
                    checked={filters.fueraDePlazo}
                    onChange={(e) => setFilter("fueraDePlazo", e.target.checked)}
                    className="h-4 w-4 accent-[var(--danger-500)]"
                  />
                  Registrados fuera de plazo
                </label>
              </div>
            </div>

            {/* Acordeones por estado */}
            <div className="flex flex-col gap-4">
              {visibleEstados.map((estado) => (
                <EstadoAccordion
                  // Al activar/desactivar filtros se reinicia la eleccion manual del usuario.
                  key={`${estado.value}-${hasActiveFilters ? "f" : "n"}`}
                  estado={estado.value}
                  summary={summary[estado.value]}
                  params={listParams}
                  version={version}
                  defaultOpen={
                    summary[estado.value].count > 0 && (hasActiveFilters || estado.value !== "PAGADO")
                  }
                  showDriver={isPrivileged}
                  vehiclesByTarga={vehiclesByTarga}
                  location={location}
                  isPrivileged={isPrivileged}
                  onChanged={refresh}
                />
              ))}
            </div>
          </div>

          <MancatoSidebar
            stats={stats}
            summary={summary}
            isPrivileged={isPrivileged}
            onSeeDetails={(estado) => setFilter("estado", estado)}
          />
        </div>
      )}
    </div>
  );
};
