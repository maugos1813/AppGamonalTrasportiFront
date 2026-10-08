import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarioMes } from "./CalendarioMes";
import { MonthSelector } from "../finanzas/MonthSelector";
import { Alert } from "../ui/Alert";
import { GlassCard } from "../ui/GlassCard";
import { Spinner } from "../ui/Spinner";
import { parseApiError } from "../../lib/api";
import { currentMonth } from "../../lib/finanzas";
import { getCalendarioRequest } from "../../lib/permisos.api";

// Asistencia de un chofer (ficha del chofer, solo oficina): su calendario del mes con dias trabajados,
// faltas y permisos.
export const AsistenciaCard = ({ driverId }) => {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    getCalendarioRequest({ month, driverId })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [month, driverId]);

  return (
    <GlassCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-medium text-ink-50">Asistencia</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Dias trabajados, faltas y permisos del chofer.{" "}
            <Link to={`/permisos/${driverId}`} className="text-accent-400 hover:text-accent-300">
              Gestionar permisos
            </Link>
          </p>
        </div>
        <MonthSelector month={month} onChange={setMonth} allowFuture />
      </div>
      <div className="mt-5">
        <Alert>{error}</Alert>
        {!data && !error && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {data && <CalendarioMes data={data} />}
      </div>
    </GlassCard>
  );
};
