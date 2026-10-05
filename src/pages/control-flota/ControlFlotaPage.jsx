import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AreaCEntryRow } from "../../components/AreaCEntryRow";
import { SpeedingSection } from "../../components/SpeedingSection";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { listAreaCEntriesRequest } from "../../lib/vehicles.api";

// Historial completo de Area C (mismas filas/acciones que la seccion homonima del
// Mapa, ver AreaCEntryRow) y de excesos de velocidad - ambos ya se registran solos en
// el backend, esta pantalla solo les da un lugar permanente para repasarlos, en vez de
// depender de que la alerta siga sin descartar en la campanita.
export const ControlFlotaPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [areaCEntries, setAreaCEntries] = useState(null);
  const [areaCTab, setAreaCTab] = useState("no-pagado");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;
    // Solo Area C: el registro de excesos de velocidad se carga aparte y a demanda
    // (ver SpeedingSection) en vez de traer todo de entrada.
    listAreaCEntriesRequest()
      .then((entries) => {
        if (!cancelled) setAreaCEntries(entries);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrivileged]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const unpaidAreaCEntries = (areaCEntries ?? []).filter((e) => !e.pagado);
  const paidAreaCEntries = (areaCEntries ?? []).filter((e) => e.pagado);
  const visibleAreaCEntries = areaCTab === "no-pagado" ? unpaidAreaCEntries : paidAreaCEntries;

  const handleAreaCEntrySaved = (updated) => {
    setAreaCEntries((prev) => (prev ?? []).map((e) => (e.id === updated.id ? updated : e)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Control de Flota</h1>
        <p className="mt-1 text-[14px] text-ink-300">
          Historial de Area C y de excesos de velocidad de todos los vehiculos.
        </p>
      </div>

      <Alert>{error}</Alert>

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-ink-50">Area C</h2>
          {areaCEntries && (
            <SegmentedControl
              options={[
                { value: "no-pagado", label: `No pagado (${unpaidAreaCEntries.length})` },
                { value: "pagado", label: `Pagado (${paidAreaCEntries.length})` },
              ]}
              value={areaCTab}
              onChange={setAreaCTab}
            />
          )}
        </div>

        {areaCEntries === null ? (
          <div className="mt-4 flex justify-center py-6">
            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
          </div>
        ) : visibleAreaCEntries.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-300">
            {areaCTab === "no-pagado" ? "Nada pendiente de pagar." : "Todavia no hay ninguna pagada."}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {visibleAreaCEntries.map((entry) => (
              <AreaCEntryRow key={entry.id} entry={entry} onSaved={handleAreaCEntrySaved} />
            ))}
          </ul>
        )}
      </GlassCard>

      <SpeedingSection />
    </div>
  );
};
