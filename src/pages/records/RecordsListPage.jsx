import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { ExportRecordsModal } from "../../components/records/ExportRecordsModal";
import { PageLoader } from "../../components/ui/PageLoader";
import { Select } from "../../components/ui/Select";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import {
  APLICATIVO_LABELS,
  EN_PROCESO_STATUSES,
  RECORD_STATUS_OPTIONS,
  TERMINADOS_STATUSES,
} from "../../lib/constants";
import { formatDate, formatDateTime, formatTimeRemaining } from "../../lib/format";
import { scopedRecordsSections } from "../../lib/permissions";
import {
  listPendingRecordsRequest,
  listRecordsByDayRequest,
  listRecordsByMonthRequest,
  listRecordsRequest,
  listRecordsSummaryByMonthRequest,
  searchRecordsRequest,
  updateRecordRequest,
} from "../../lib/records.api";
import { getAppsheetSyncStatusRequest, runAppsheetSyncRequest } from "../../lib/sync.api";

const SyncIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

const DownloadIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 3v13" />
    <path d="M7 11l5 5 5-5" />
    <path d="M4 21h16" />
  </svg>
);

const SYNC_ERROR_PREVIEW = 5;

const TAB_OPTIONS = [
  { value: "en_proceso", label: "En proceso" },
  { value: "terminados", label: "Terminados" },
];

const TAB_STATUSES = {
  en_proceso: EN_PROCESO_STATUSES,
  terminados: TERMINADOS_STATUSES,
};

// "Extras Piazza" es lo unico que existia hasta ahora: los registros viejos no
// tienen spedizzione cargada, asi que se tratan como Extras Piazza por defecto.
// "DHL - AB Service" agrupa ambos spedizzione; el alta desde esta seccion crea
// siempre servicios DHL (AB_SERVICE por ahora solo llega via sincronizacion externa).
// "Extras Stefania" la administra el mismo ADMIN de DHL (ver ADMIN_AREA_RECORDS_SECTION).
// Las 3 quedan definidas igual (rutas /new y edicion siguen andando si se entra por
// URL directa), pero SECTION_OPTIONS de mas abajo solo ofrece navegar a "extras-piazza"
// y "dhl-ab-service" (ahora acotada a DHL Roma) - pedido explicito: Registros solo
// muestra Extras Piazza Milano/Roma + DHL Roma, ocultando DHL Milano/AB Service/Extras
// Stefania para cualquiera que entre (OWNER, y tambien el ADMIN de area DHL).
const SECTIONS = {
  "extras-piazza": {
    label: "Extras Piazza",
    matchesSpedizzione: (s) => s === "EXTRA_PIAZZA" || s == null,
    allowCreate: true,
    newPath: "/records/extras-piazza/new",
  },
  "dhl-ab-service": {
    label: "DHL Roma",
    matchesSpedizzione: (s) => s === "DHL",
    allowCreate: true,
    newPath: "/records/dhl-ab-service/new",
  },
  "extras-stefania": {
    label: "Extras Stefania",
    matchesSpedizzione: (s) => s === "EXTRAS_STEFANIA",
    allowCreate: true,
    newPath: "/records/extras-stefania/new",
  },
};
const VISIBLE_SECTION_KEYS = ["extras-piazza", "dhl-ab-service"];
const SECTION_OPTIONS = VISIBLE_SECTION_KEYS.map((value) => ({ value, label: SECTIONS[value].label }));

// Switch Milano/Roma dentro de cada seccion (ver extrasPiazzaZona en el registro).
// Extras Stefania no tiene, no opera por zona. "dhl-ab-service" quedo acotada a un
// solo valor (Roma) a proposito - ver comentario de SECTIONS arriba - asi que no
// necesita switch, matchesZona igual exige "ROMA" con esta unica opcion.
const ZONA_OPTIONS_BY_SECTION = {
  "extras-piazza": [
    { value: "MILANO", label: "Milano" },
    { value: "ROMA", label: "Roma" },
  ],
  "dhl-ab-service": [{ value: "ROMA", label: "Roma" }],
};

// El backend arma los rangos /:year/:month/:day en UTC (buildDateRange). El resumen
// del mes se agrupa client-side, asi que tiene que usar el mismo criterio de "dia"
// (UTC), o el conteo del resumen y lo que trae el fetch puntual de un dia no van a
// coincidir para usuarios en husos horarios distintos a UTC.
const dayKey = (value) => {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const monthLabel = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
const dayLabel = (value) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });

const driverName = (record) =>
  record.driver ? `${record.driver.nombre} ${record.driver.apellido}` : "Sin chofer asignado";

const isDhlAb = (record) => record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE";
const isExtrasStefania = (record) => record.spedizzione === "EXTRAS_STEFANIA";

const fmtKm = (km) => Math.round(km).toLocaleString("es-AR");

// Urgencia por tiempo restante a la ETA: >1h verde, 31-59min naranja, <=30min (o ya
// vencido) rojo - para que el panel de Pendientes se pueda escanear de un vistazo.
const URGENCY_STYLES = {
  verde: "border-l-success-500",
  naranja: "border-l-amber-500",
  rojo: "border-l-danger-500",
};

const urgencyLevel = (etaValue) => {
  if (!etaValue) return "verde";
  const diffMin = (new Date(etaValue).getTime() - Date.now()) / 60000;
  if (diffMin >= 60) return "verde";
  if (diffMin >= 31) return "naranja";
  return "rojo";
};

// Agrupa el resumen (liviano, solo id/fechaServicio/estado) de un mes por dia de
// SERVICIO (no de creacion: un import historico masivo puede crearse todo el mismo
// dia pero corresponder a fechas de servicio bien distintas). Mas reciente primero.
const groupSummaryByDay = (list) => {
  const days = new Map();
  for (const item of list) {
    const dKey = dayKey(item.fechaServicio);
    if (!days.has(dKey)) days.set(dKey, { key: dKey, date: item.fechaServicio, count: 0 });
    days.get(dKey).count += 1;
  }
  return Array.from(days.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
};

const shiftMonth = ({ year, month }, delta) => {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
};

// Igual al SegmentedControl visualmente, pero enrutado (NavLink) en vez de
// controlado por estado, para que la seccion quede reflejada en la URL.
// allowedSections: si el ADMIN esta acotado a mas de una seccion (ej. DHL: DHL - AB
// Service + Extras Stefania), solo se muestran esas, nunca las que no puede ver.
const SectionTabs = ({ allowedSections }) => {
  const options = allowedSections
    ? SECTION_OPTIONS.filter((opt) => allowedSections.includes(opt.value))
    : SECTION_OPTIONS;
  return (
  <div className="inline-flex items-center gap-1 rounded-full glass-surface-sm p-1">
    {options.map((opt) => (
      <NavLink
        key={opt.value}
        to={`/records/${opt.value}`}
        className={({ isActive }) =>
          `rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
            isActive ? "bg-line/15 text-ink-50" : "text-ink-300 hover:text-ink-50"
          }`
        }
      >
        {opt.label}
      </NavLink>
    ))}
  </div>
  );
};

const ChevronIcon = ({ open }) => (
  <svg
    className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DisclosureHeader = ({ open, onClick, children, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-2 text-left ${className ?? ""}`}
  >
    {children}
    <ChevronIcon open={open} />
  </button>
);

// state: backgroundLocation - para que App.jsx renderice el detalle como overlay
// sobre esta misma lista (que sigue montada) en vez de reemplazarla, evitando el
// refetch innecesario de volver a esta pantalla (ver App.jsx).
const RecordCard = ({ record }) => {
  const location = useLocation();
  return (
    <Link to={`/records/${record.id}`} state={{ backgroundLocation: location }}>
      <GlassCard className="transition-colors hover:bg-line/[0.08]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-medium text-ink-400">{record.codigo}</span>
          <h2 className="mt-0.5 text-[17px] font-medium text-ink-50">{record.destinazione}</h2>
        </div>
        <StatusBadge status={record.estado} />
      </div>

      <p className="mt-2 line-clamp-2 text-[14px] text-ink-300">{record.descripcion}</p>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-400">
        <span>Servicio: {formatDate(record.fechaServicio)}</span>
        <span>ETA: {formatDate(record.eta)}</span>
        <span>
          Vehiculo: {record.vehicle?.targa} - {record.vehicle?.modelo}
        </span>
        <span>Cliente: {record.client?.nombre}</span>
      </div>
      </GlassCard>
    </Link>
  );
};

const ROW_COLUMN_CLASSES = {
  chofer: "w-32 shrink-0 truncate",
  vehiculo: "w-28 shrink-0 truncate",
  estado: "w-24 shrink-0",
  eta: "w-56 shrink-0 truncate",
  km: "w-16 shrink-0 text-right",
  destino: "min-w-0 flex-1 truncate",
  aplicativo: "w-24 shrink-0 truncate text-right",
};

const CompactRowHeader = () => (
  <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
    <span className={ROW_COLUMN_CLASSES.chofer}>Chofer</span>
    <span className={ROW_COLUMN_CLASSES.vehiculo}>Vehiculo</span>
    <span className={ROW_COLUMN_CLASSES.estado}>Estado</span>
    <span className={ROW_COLUMN_CLASSES.eta}>ETA / restante</span>
    <span className={ROW_COLUMN_CLASSES.km}>KM</span>
    <span className={ROW_COLUMN_CLASSES.destino}>Destino</span>
    <span className={ROW_COLUMN_CLASSES.aplicativo}>Aplicativo</span>
  </div>
);

// Fila compacta (50px) para escanear muchos servicios de un mismo dia de un vistazo.
const RecordRow = ({ record }) => {
  const location = useLocation();
  return (
  <Link
    to={`/records/${record.id}`}
    state={{ backgroundLocation: location }}
    className="flex h-[50px] items-center gap-3 rounded-xl px-4 text-[12px] text-ink-200 transition-colors hover:bg-line/[0.08]"
  >
    <span className={ROW_COLUMN_CLASSES.chofer} title={driverName(record)}>
      {driverName(record)}
    </span>
    <span className={ROW_COLUMN_CLASSES.vehiculo} title={record.vehicle?.targa}>
      {record.vehicle?.targa ?? "-"}
    </span>
    <span className={ROW_COLUMN_CLASSES.estado}>
      <StatusBadge status={record.estado} className="px-2 py-0.5 text-[11px]" />
    </span>
    <span className={ROW_COLUMN_CLASSES.eta} title={formatDate(record.eta)}>
      {/* "Vencido hace X" no tiene sentido para un servicio ya terminado - ahi solo
          se muestra la fecha de referencia, no la cuenta regresiva/vencida. */}
      {TERMINADOS_STATUSES.includes(record.estado) ? formatDate(record.eta) : formatTimeRemaining(record.eta)}
    </span>
    <span className={ROW_COLUMN_CLASSES.km}>{record.kilometros ?? "-"}</span>
    <span className={ROW_COLUMN_CLASSES.destino} title={record.destinazione}>
      {record.destinazione}
    </span>
    <span className={ROW_COLUMN_CLASSES.aplicativo}>
      {APLICATIVO_LABELS[record.aplicativo] ?? "-"}
    </span>
  </Link>
  );
};

const now = new Date();
const CURRENT_VIEW_DATE = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };

// Fila del panel de Pendientes: sin agrupar por dia (a diferencia del acordeon de la
// izquierda) para poder escanear la urgencia de todo de un vistazo, ordenado por ETA.
// El link (abre el detalle completo) y el selector de estado van separados: un
// <select> no puede anidarse dentro de un <a> (lo que renderiza Link). Es un select
// (no un boton de "marcar entregado") a proposito: un clic de mas en un boton
// cambiaria el estado sin querer, mientras que elegir de una lista requiere abrirla
// primero.
const PendingRow = ({ record, closeTo, onChangeEstado, updating }) => {
  const location = useLocation();
  return (
  <div className={`rounded-xl border-l-4 ${URGENCY_STYLES[urgencyLevel(record.eta)]} glass-surface-sm text-[13px]`}>
    <Link
      to={`/records/${record.id}`}
      state={{ from: closeTo, backgroundLocation: location }}
      className="flex flex-col gap-1 px-3 pt-2.5 transition-colors hover:opacity-90"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-ink-50">{record.codigo}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
            isDhlAb(record)
              ? "bg-accent-500/15 text-accent-300"
              : isExtrasStefania(record)
                ? "bg-success-500/15 text-success-500"
                : "bg-line/15 text-ink-300"
          }`}
        >
          {isDhlAb(record) ? "DHL/AB" : isExtrasStefania(record) ? "Extras Stefania" : "Extras Piazza"}
        </span>
      </div>
      <span className="min-w-0 truncate text-ink-300">{record.destinazione}</span>
      <div className="flex items-center justify-between gap-2 text-[12px] text-ink-400">
        <span className="min-w-0 truncate">{driverName(record)}</span>
        <span className="shrink-0">{formatTimeRemaining(record.eta)}</span>
      </div>
    </Link>
    <div className="px-3 pb-2.5 pt-1.5">
      <Select
        id={`estado-${record.id}`}
        options={RECORD_STATUS_OPTIONS}
        value={record.estado}
        disabled={updating}
        onChange={(e) => onChangeEstado(record.id, e.target.value)}
        className="!py-1.5 !text-[12px]"
      />
    </div>
  </div>
  );
};

// El backend ya filtra (en curso, servicios de hoy) y ordena por ETA - solo se renderiza tal cual.
// scopedLabel: si es un ADMIN de area, el backend ya solo le manda su seccion, asi que
// el subtitulo no debe prometer "Extras Piazza y DHL - AB Service juntos".
const PendingPanel = ({ records: pending, closeTo, onChangeEstado, updatingId, scopedLabel }) => {
  return (
    <GlassCard className="flex min-w-0 flex-col !p-4 lg:h-[calc(100dvh-220px)]">
      <h2 className="px-1 text-[15px] font-semibold text-ink-50">Pendientes</h2>
      <p className="mb-3 px-1 text-[12px] text-ink-400">
        {scopedLabel
          ? `Servicios de hoy de ${scopedLabel}, ordenado por lo mas urgente.`
          : "Servicios de hoy: Extras Piazza, DHL - AB Service y Extras Stefania juntos, ordenado por lo mas urgente."}
      </p>

      <div className="flex flex-col gap-2 overflow-y-auto">
        {pending === undefined && (
          <div className="flex justify-center py-8">
            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
          </div>
        )}
        {pending?.length === 0 && (
          <p className="py-4 text-center text-[13px] text-ink-300">No hay servicios pendientes.</p>
        )}
        {pending?.map((record) => (
          <PendingRow
            key={record.id}
            record={record}
            closeTo={closeTo}
            updating={updatingId === record.id}
            onChangeEstado={onChangeEstado}
          />
        ))}
      </div>
    </GlassCard>
  );
};

export const RecordsListPage = ({ section }) => {
  const location = useLocation();
  const { version, refresh: refreshRecords } = useDataRefresh("records");
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  // ADMIN "de area" (ver lib/permissions.js): solo puede estar en su(s) propia(s)
  // seccion(es), las demas ni siquiera se le ofrecen (el backend tampoco le manda
  // esos registros). Puede ser mas de una (ej. DHL: DHL - AB Service + Extras
  // Stefania), por eso es un array.
  const scopedSections = scopedRecordsSections(user);
  const sectionConfig = SECTIONS[section];
  const zonaOptions = ZONA_OPTIONS_BY_SECTION[section];
  const [error, setError] = useState("");
  const [tab, setTab] = useState("en_proceso");
  const [zonaFilter, setZonaFilter] = useState(() => zonaOptions?.[0]?.value ?? null);
  // Sin switch (Extras Stefania) matchea cualquier zona - no filtra nada.
  const matchesZona = (r) => !zonaOptions || r.extrasPiazzaZona === zonaFilter;

  // Sincronizacion manual con AppSheet (antes vivia en Mi perfil) - solo
  // OWNER/ADMIN, un boton chico redondo arriba de la lista en vez de una seccion
  // aparte.
  const [syncState, setSyncState] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    if (!isPrivileged) return;
    getAppsheetSyncStatusRequest()
      .then(setSyncState)
      .catch(() => {});
  }, [isPrivileged]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const result = await runAppsheetSyncRequest();
      setSyncResult(result);
      if (result.created > 0) refreshRecords();
      const state = await getAppsheetSyncStatusRequest();
      setSyncState(state);
    } catch (err) {
      setSyncError(parseApiError(err).message);
    } finally {
      setSyncing(false);
    }
  };

  // --- Vista OWNER/ADMIN: navega mes a mes, trae solo un resumen liviano del mes
  // y recien pide los registros completos del dia cuando se despliega ese dia. ---
  const [viewDate, setViewDate] = useState(CURRENT_VIEW_DATE);
  const [summary, setSummary] = useState(null);
  const [openDays, setOpenDays] = useState(() => new Set());
  const [dayRecords, setDayRecords] = useState(() => new Map());
  const [loadingDays, setLoadingDays] = useState(() => new Set());
  const [dayErrors, setDayErrors] = useState(() => new Map());

  // --- Vista CHOFER: lista plana simple, trae todo de una (siempre es poco, son
  // solo sus propios servicios). ---
  const [records, setRecords] = useState(null);

  // Panel de Pendientes (OWNER/ADMIN): junta Extras Piazza y DHL - AB Service sin
  // separar por seccion, asi que se trae aparte del resumen mensual (que si esta
  // filtrado por seccion). Se pide una sola vez al entrar a Registros.
  const [pendingRecords, setPendingRecords] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Buscador (codigo/cliente/chofer/destino): reemplaza el acordeon de la izquierda
  // mientras hay una busqueda activa. null = sin busqueda, [] = sin resultados.
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Filtro "Solo sin cobrar": igual que el buscador, reemplaza el acordeon mientras
  // esta activo, pero acotado al mes que se esta navegando (no todo el historico,
  // que puede ser miles de registros). Pide el mes completo con detalle economico
  // (listRecordsByMonthRequest) porque el resumen liviano del acordeon no trae
  // pagoRecibido.
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [unpaidRecords, setUnpaidRecords] = useState(null);

  // Fuerza un re-render cada minuto para que "tiempo restante antes de vencer" no quede desactualizado.
  const [, setTick] = useState(0);
  useEffect(() => {
    const intervalId = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isPrivileged) return;
    let cancelled = false;

    listRecordsRequest()
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, version]);

  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;

    listPendingRecordsRequest()
      .then((data) => {
        if (!cancelled) setPendingRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, version]);

  // Debounce: espera a que se deje de tipear antes de pegarle al backend. Menos de 2
  // caracteres limpia los resultados en vez de buscar (ver SEARCH_MIN_LENGTH del backend).
  useEffect(() => {
    if (!isPrivileged) return;
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      searchRecordsRequest(query)
        .then((data) => {
          if (!cancelled) setSearchResults(data);
        })
        .catch((err) => {
          if (!cancelled) setError(parseApiError(err).message);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isPrivileged, searchQuery]);

  const handleChangeEstado = async (recordId, estado) => {
    setUpdatingId(recordId);
    try {
      await updateRecordRequest(recordId, { estado });
      setPendingRecords((prev) => {
        if (!prev) return prev;
        // Si el nuevo estado ya no es "en proceso" (ej. Entregado/Anulado), sale del
        // panel de Pendientes; si sigue en curso, se actualiza en el lugar.
        if (!EN_PROCESO_STATUSES.includes(estado)) {
          return prev.filter((r) => r.id !== recordId);
        }
        return prev.map((r) => (r.id === recordId ? { ...r, estado } : r));
      });
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;
    setSummary(null);

    listRecordsSummaryByMonthRequest(viewDate.year, viewDate.month)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, viewDate.year, viewDate.month, version]);

  useEffect(() => {
    if (!isPrivileged || !showUnpaidOnly) {
      setUnpaidRecords(null);
      return;
    }
    let cancelled = false;
    setUnpaidRecords(null);

    listRecordsByMonthRequest(viewDate.year, viewDate.month)
      .then((data) => {
        if (!cancelled) setUnpaidRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, showUnpaidOnly, viewDate.year, viewDate.month, version]);

  const fetchDay = (day) => {
    setLoadingDays((prev) => new Set(prev).add(day.key));
    const d = new Date(day.date);
    listRecordsByDayRequest(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      .then((data) => {
        setDayRecords((prev) => new Map(prev).set(day.key, data));
      })
      .catch((err) => {
        setDayErrors((prev) => new Map(prev).set(day.key, parseApiError(err).message));
      })
      .finally(() => {
        setLoadingDays((prev) => {
          const next = new Set(prev);
          next.delete(day.key);
          return next;
        });
      });
  };

  const toggleDay = (day) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day.key)) next.delete(day.key);
      else next.add(day.key);
      return next;
    });
    if (!dayRecords.has(day.key) && !loadingDays.has(day.key)) fetchDay(day);
  };

  // Se creo/edito/borro un registro en otra pantalla (ver DataRefreshContext) - los
  // dias ya desplegados quedaron con el cache viejo (fetchDay solo pide un dia la
  // primera vez que se abre, ver toggleDay), asi que se vuelven a pedir. Se ignora el
  // primer render (version arranca en 0, no hay nada que refrescar todavia).
  const isFirstVersionRender = useRef(true);
  useEffect(() => {
    if (isFirstVersionRender.current) {
      isFirstVersionRender.current = false;
      return;
    }
    setDayRecords(new Map());
    setDayErrors(new Map());
    openDays.forEach((key) => {
      const [year, month, day] = key.split("-").map(Number);
      fetchDay({ key, date: new Date(Date.UTC(year, month - 1, day)) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const visibleRecords = records?.filter(
    (r) => TAB_STATUSES[tab].includes(r.estado) && sectionConfig.matchesSpedizzione(r.spedizzione) && matchesZona(r)
  );
  const summaryDays = summary
    ? groupSummaryByDay(summary.filter((r) => sectionConfig.matchesSpedizzione(r.spedizzione) && matchesZona(r)))
    : null;
  const unpaidVisibleRecords = unpaidRecords
    ?.filter((r) => sectionConfig.matchesSpedizzione(r.spedizzione) && matchesZona(r) && r.pagoRecibido == null)
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

  // Total de KM del mes, Extras Piazza vs DHL/AB Service vs Extras Stefania - de todo
  // el mes (no solo la seccion que se esta mirando), para tener una idea general del
  // volumen sin tener que cambiar de pestana. DHL/AB pesa x2 en los rankings (ver
  // kmMultiplier en dashboardStats.js), asi que se muestra el crudo y el ponderado por
  // separado. Extras Stefania pesa x1, igual que Extras Piazza.
  const monthKmTotals = summary?.reduce(
    (acc, r) => {
      const km = r.kilometros ?? r.kilometrosReales ?? 0;
      if (isDhlAb(r)) acc.dhlAb += km;
      else if (isExtrasStefania(r)) acc.extrasStefania += km;
      else acc.extrasPiazza += km;
      return acc;
    },
    { extrasPiazza: 0, dhlAb: 0, extrasStefania: 0 }
  );

  // Un ADMIN de area no tiene ninguna otra seccion como opcion (backend tampoco le
  // manda esos registros) - se lo redirige de vuelta a la primera de las suyas.
  if (scopedSections && !scopedSections.includes(section)) {
    return <Navigate to={`/records/${scopedSections[0]}`} replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">{sectionConfig.label}</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            {isPrivileged
              ? "Navega mes a mes; cada dia se carga al desplegarlo."
              : "Viajes asignados, ordenados por fecha."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Un ADMIN de area con una sola seccion no tiene a donde mas ir, asi que no
              se le muestra el selector. Uno con 2+ (ej. DHL: DHL - AB Service +
              Extras Stefania) si necesita elegir entre las suyas. */}
          {(!scopedSections || scopedSections.length > 1) && <SectionTabs allowedSections={scopedSections} />}
          {/* zonaOptions con 1 solo valor (hoy: DHL Roma) no necesita switch - ya esta
              fijo, mostrar un SegmentedControl de un boton no aporta nada. */}
          {zonaOptions && zonaOptions.length > 1 && (
            <SegmentedControl options={zonaOptions} value={zonaFilter} onChange={setZonaFilter} />
          )}
          {/* En proceso/Terminados solo tiene sentido para el chofer: no tiene el panel
              de Pendientes ni navegacion mes a mes, asi que es su unica forma de acotar
              la lista. El OWNER/ADMIN ya tiene Pendientes a la derecha, asi que ve todo
              el mes junto (el StatusBadge de cada fila alcanza para diferenciar). */}
          {!isPrivileged && <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />}
          {isPrivileged && (
            <button
              type="button"
              aria-label="Sincronizar con AppSheet"
              title={
                syncState?.lastSyncedAt
                  ? `Ultima sincronizacion: ${formatDateTime(syncState.lastSyncedAt)}`
                  : "Todavia no se sincronizo nunca"
              }
              onClick={handleSync}
              disabled={syncing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-accent-500/15 hover:text-accent-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SyncIcon className={`h-[16px] w-[16px] ${syncing ? "animate-spin" : ""}`} />
            </button>
          )}
          {isPrivileged && (
            <button
              type="button"
              aria-label="Exportar a CSV"
              title="Exportar registros a CSV"
              onClick={() => setShowExportModal(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-accent-500/15 hover:text-accent-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/20"
            >
              <DownloadIcon className="h-[16px] w-[16px]" />
            </button>
          )}
          {isPrivileged && sectionConfig.allowCreate && (
            // Se manda la zona activa (si esta seccion tiene switch) para que el
            // formulario de alta arranque en la misma zona que se esta mirando - antes
            // "Nuevo servicio" desde Roma igual abria el formulario en Milano por
            // defecto, distinto de lo que se ve en Milano (arranca en Milano siempre).
            <Link
              to={sectionConfig.newPath}
              state={{ backgroundLocation: location, zona: zonaOptions ? zonaFilter : undefined }}
            >
              <Button className="w-auto px-5">Nuevo servicio</Button>
            </Link>
          )}
        </div>
      </div>

      {isPrivileged && (syncError || syncResult) && (
        <div className="flex flex-col gap-2">
          <Alert>{syncError}</Alert>
          {syncResult && (
            <div className="rounded-xl glass-surface-sm px-4 py-3 text-[13px] text-ink-200">
              <p>
                <span className="text-success-500">{syncResult.created} creados</span>
                {" · "}
                <span className="text-ink-400">{syncResult.skipped} ya sincronizados</span>
                {" · "}
                <span className={syncResult.errors.length ? "text-danger-500" : "text-ink-400"}>
                  {syncResult.errors.length} con error
                </span>
              </p>
              {syncResult.errors.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-ink-300">
                  {syncResult.errors.slice(0, SYNC_ERROR_PREVIEW).map((e) => (
                    <li key={`${e.row}-${e.id}`}>
                      Fila {e.row} ({e.id}): {e.reason}
                    </li>
                  ))}
                  {syncResult.errors.length > SYNC_ERROR_PREVIEW && (
                    <li>...y {syncResult.errors.length - SYNC_ERROR_PREVIEW} mas.</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {isPrivileged && (
        <div className="flex flex-wrap items-center gap-3">
          <TextField
            id="records-search"
            placeholder="Buscar por codigo, cliente o chofer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sm:max-w-sm"
          />
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-300">
            <input
              type="checkbox"
              checked={showUnpaidOnly}
              onChange={(e) => setShowUnpaidOnly(e.target.checked)}
              className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
            />
            Solo sin cobrar
          </label>
        </div>
      )}

      <Alert>{error}</Alert>

      {!isPrivileged && records === null && !error && <PageLoader />}

      {!isPrivileged && visibleRecords?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          {tab === "en_proceso"
            ? "No tienes registros en proceso."
            : "Todavia no tienes registros terminados."}
        </GlassCard>
      )}

      {isPrivileged ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          <GlassCard className="min-w-0 !p-0">
            {searchResults !== null ? (
              <div className="flex items-center justify-between gap-2 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-ink-100">
                  Resultados de busqueda{searching && " - buscando..."}
                </h2>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
                >
                  Volver al mes
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setViewDate((v) => shiftMonth(v, -1))}
                  className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
                >
                  &larr; Mes anterior
                </button>
                <div className="flex flex-col items-center gap-0.5">
                  <h2 className="text-[15px] font-semibold uppercase text-ink-100">
                    {monthLabel(viewDate.year, viewDate.month)}
                  </h2>
                  {monthKmTotals && (
                    <p className="text-[11px] normal-case text-ink-400">
                      Extras Piazza: {fmtKm(monthKmTotals.extrasPiazza)} km · DHL - AB Service:{" "}
                      {fmtKm(monthKmTotals.dhlAb)} km x2 = {fmtKm(monthKmTotals.dhlAb * 2)} km · Extras Stefania:{" "}
                      {fmtKm(monthKmTotals.extrasStefania)} km
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setViewDate((v) => shiftMonth(v, 1))}
                  className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
                >
                  Mes siguiente &rarr;
                </button>
              </div>
            )}

            {searchResults !== null ? (
              <div className="border-t border-line/10 px-2 pb-4 pt-3">
                {searchResults.length === 0 ? (
                  <p className="py-4 text-center text-[14px] text-ink-300">
                    Sin resultados para "{searchQuery.trim()}".
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[720px]">
                      <CompactRowHeader />
                      <div className="flex flex-col gap-0.5 px-2">
                        {searchResults.map((record) => (
                          <RecordRow key={record.id} record={record} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : showUnpaidOnly ? (
              <div className="border-t border-line/10 px-2 pb-4 pt-3">
                {unpaidVisibleRecords === undefined ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                  </div>
                ) : unpaidVisibleRecords.length === 0 ? (
                  <p className="py-4 text-center text-[14px] text-ink-300">
                    Ningun servicio de {sectionConfig.label} sin cobrar este mes.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[720px]">
                      <CompactRowHeader />
                      <div className="flex flex-col gap-0.5 px-2">
                        {unpaidVisibleRecords.map((record) => (
                          <RecordRow key={record.id} record={record} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <div className="flex flex-col gap-2 border-t border-line/10 px-5 pb-4 pt-3">
              {summary === null && (
                <div className="flex justify-center py-8">
                  <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                </div>
              )}

              {summaryDays?.length === 0 && (
                <p className="py-4 text-center text-[14px] text-ink-300">No hay servicios este mes.</p>
              )}

              {summaryDays?.map((day) => {
                const dayOpen = openDays.has(day.key);
                const loaded = dayRecords.get(day.key);
                const dayVisibleRecords = loaded
                  ?.filter((r) => sectionConfig.matchesSpedizzione(r.spedizzione) && matchesZona(r))
                  .sort((a, b) => driverName(a).localeCompare(driverName(b)));

                return (
                  <div key={day.key} className="rounded-2xl glass-surface-sm">
                    <DisclosureHeader
                      open={dayOpen}
                      onClick={() => toggleDay(day)}
                      className="px-4 py-3 text-[14px] text-ink-100"
                    >
                      <span>
                        {dayLabel(day.date)}{" "}
                        <span className="text-ink-400">
                          ({day.count} servicio{day.count === 1 ? "" : "s"})
                        </span>
                      </span>
                    </DisclosureHeader>

                    {dayOpen && (
                      <div className="border-t border-line/10 pb-2">
                        {loadingDays.has(day.key) && (
                          <div className="flex justify-center py-6">
                            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                          </div>
                        )}
                        {dayErrors.has(day.key) && <Alert>{dayErrors.get(day.key)}</Alert>}
                        {dayVisibleRecords && (
                          <div className="overflow-x-auto">
                            <div className="min-w-[720px]">
                              <CompactRowHeader />
                              <div className="flex flex-col gap-0.5 px-2">
                                {dayVisibleRecords.map((record) => (
                                  <RecordRow key={record.id} record={record} />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </GlassCard>

          <PendingPanel
            records={pendingRecords}
            closeTo={`/records/${section}`}
            scopedLabel={
              scopedSections
                ? scopedSections.map((s) => SECTIONS[s]?.label).filter(Boolean).join(" y ")
                : null
            }
            onChangeEstado={handleChangeEstado}
            updatingId={updatingId}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleRecords?.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}

      {isPrivileged && (
        <ExportRecordsModal open={showExportModal} onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
};
