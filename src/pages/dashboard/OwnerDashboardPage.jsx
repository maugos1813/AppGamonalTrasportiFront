import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClientDistributionChart } from "../../components/charts/ClientDistributionChart";
import { EconomicsChart } from "../../components/charts/EconomicsChart";
import { ServicesStatusChart } from "../../components/charts/ServicesStatusChart";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { RECORD_STATUS_LABELS } from "../../lib/constants";
import {
  computeClientDistribution,
  computeDriverStats,
  computeEconomicStats,
  computeServiceStats,
  computeVehicleStats,
} from "../../lib/dashboardStats";
import { formatCurrency } from "../../lib/format";
import { listRecordsRequest } from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const PERIOD_OPTIONS = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

const PERIOD_DELTA_LABEL = {
  hoy: "vs ayer",
  semana: "vs semana pasada",
  mes: "vs mes pasado",
};

export const OwnerDashboardPage = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("mes");

  useEffect(() => {
    let cancelled = false;

    Promise.all([listRecordsRequest(), listVehiclesRequest(), listUsersRequest()])
      .then(([recordsData, vehiclesData, usersData]) => {
        if (cancelled) return;
        setRecords(recordsData);
        setVehicles(vehiclesData);
        setUsers(usersData);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = records && vehicles && users;

  const serviceStats = useMemo(() => (loaded ? computeServiceStats(records) : null), [loaded, records]);
  const vehicleStats = useMemo(
    () => (loaded ? computeVehicleStats(vehicles, records) : null),
    [loaded, vehicles, records]
  );
  const driverStats = useMemo(
    () => (loaded ? computeDriverStats(users, records) : null),
    [loaded, users, records]
  );
  const economicStats = useMemo(
    () => (loaded ? computeEconomicStats(records, period) : null),
    [loaded, records, period]
  );
  const clientDistribution = useMemo(
    () => (loaded ? computeClientDistribution(records, period) : null),
    [loaded, records, period]
  );

  if (error) return <Alert>{error}</Alert>;

  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 border-line/20 border-t-line" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Hola, {user?.nombre}</h1>
        <p className="mt-1 text-[14px] text-ink-300">Vision general del negocio.</p>
      </div>

      {/* Orden fijo en todas las pantallas: Control economico, Servicios, Control de
          choferes, Control operativo. En mobile se apilan en ese orden; desde lg+ el
          grid de 2 columnas los acomoda 2x2 (economico/servicios arriba). */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6">
        <GlassCard className="flex flex-col lg:h-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-medium text-ink-50">Control economico</h2>
            <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Facturacion"
              value={formatCurrency(economicStats.facturacion)}
              tone="blue"
              deltaPct={economicStats.facturacionDeltaPct}
              deltaLabel={PERIOD_DELTA_LABEL[period]}
            />
            <StatCard label="Costos operativos" value={formatCurrency(economicStats.costos)} />
            <StatCard
              label="Ganancia estimada"
              value={formatCurrency(economicStats.ganancia)}
              tone={economicStats.ganancia >= 0 ? "green" : "red"}
              deltaPct={economicStats.gananciaDeltaPct}
              deltaLabel={PERIOD_DELTA_LABEL[period]}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
                Facturacion vs costos
              </h3>
              <EconomicsChart
                facturacion={economicStats.facturacion}
                costos={economicStats.costos}
                ganancia={economicStats.ganancia}
              />
            </div>
            <div>
              <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
                Distribucion por cliente
              </h3>
              <ClientDistributionChart data={clientDistribution} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RankedList
              title="Servicios mas rentables"
              items={economicStats.masRentables}
              tone="green"
            />
            <RankedList title="Servicios con perdidas" items={economicStats.conPerdidas} tone="red" />
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col lg:h-full">
          <h2 className="text-[17px] font-medium text-ink-50">Servicios</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Creados hoy" value={serviceStats.creadosHoy} tone="blue" />
            <StatCard label="Programados hoy" value={serviceStats.programadosHoy} tone="blue" />
            {Object.entries(serviceStats.byEstado).map(([estado, count]) => (
              <StatCard key={estado} label={RECORD_STATUS_LABELS[estado]} value={count} />
            ))}
          </div>
          {/* flex-1 + min-h-0: si esta tarjeta queda mas baja que "Control economico"
              (mismo alto de fila en el grid), el grafico crece para ocupar el espacio
              libre en vez de dejarlo vacio. */}
          <div className="mt-6 min-h-[220px] flex-1">
            <ServicesStatusChart byEstado={serviceStats.byEstado} />
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Control de choferes</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total choferes" value={driverStats.total} />
            <StatCard label="Activos" value={driverStats.activos} tone="green" />
            <StatCard label="Con servicio hoy" value={driverStats.conServicioHoy} tone="blue" />
            <StatCard label="Disponibles ahora" value={driverStats.disponiblesAhora} tone="green" />
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Control operativo</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Total vehiculos" value={vehicleStats.total} />
            <StatCard label="Disponibles" value={vehicleStats.disponibles} tone="green" />
            <StatCard label="En servicio" value={vehicleStats.enServicioAhora} tone="blue" />
            <StatCard label="En mantenimiento" value={vehicleStats.enMantenimiento} tone="amber" />
            <StatCard label="Fuera de servicio" value={vehicleStats.fueraDeServicio} tone="red" />
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

const RankedList = ({ title, items, tone }) => (
  <div>
    <h3 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-ink-400">{title}</h3>
    {items.length === 0 ? (
      <p className="text-[13px] text-ink-400">Sin datos en este periodo.</p>
    ) : (
      <ul className="flex flex-col gap-2">
        {items.map(({ record, profit }) => (
          <li key={record.id}>
            <Link
              to={`/records/${record.id}`}
              className="flex items-center justify-between rounded-xl glass-surface-sm px-4 py-2.5 text-[13px] hover:bg-line/10"
            >
              <span className="text-ink-50">
                {record.codigo} - {record.destinazione}
              </span>
              <span className={tone === "green" ? "text-success-500" : "text-danger-500"}>
                {formatCurrency(profit)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </div>
);
