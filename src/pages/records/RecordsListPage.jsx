import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { EN_PROCESO_STATUSES, TERMINADOS_STATUSES } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import { listRecordsRequest } from "../../lib/records.api";

const TAB_OPTIONS = [
  { value: "en_proceso", label: "En proceso" },
  { value: "terminados", label: "Terminados" },
];

const TAB_STATUSES = {
  en_proceso: EN_PROCESO_STATUSES,
  terminados: TERMINADOS_STATUSES,
};

export const RecordsListPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("en_proceso");

  useEffect(() => {
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
  }, []);

  const visibleRecords = records?.filter((r) => TAB_STATUSES[tab].includes(r.estado));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Mis registros</h1>
          <p className="mt-1 text-[14px] text-ink-300">Viajes asignados, ordenados por fecha.</p>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
          {isPrivileged && (
            <Link to="/records/new">
              <Button className="w-auto px-5">Nuevo servicio</Button>
            </Link>
          )}
        </div>
      </div>

      <Alert>{error}</Alert>

      {records === null && !error && (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 border-white/20 border-t-white" />
        </div>
      )}

      {visibleRecords?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          {tab === "en_proceso"
            ? "No tienes registros en proceso."
            : "Todavia no tienes registros terminados."}
        </GlassCard>
      )}

      <div className="flex flex-col gap-3">
        {visibleRecords?.map((record) => (
          <Link key={record.id} to={`/records/${record.id}`}>
            <GlassCard className="transition-colors hover:bg-white/[0.08]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[13px] font-medium text-ink-400">{record.codigo}</span>
                  <h2 className="mt-0.5 text-[17px] font-medium text-ink-50">
                    {record.destinazione}
                  </h2>
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
        ))}
      </div>
    </div>
  );
};
