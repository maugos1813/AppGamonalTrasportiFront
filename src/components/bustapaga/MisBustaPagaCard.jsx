import { useCallback, useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import { Spinner } from "../ui/Spinner";
import { FileTextIcon } from "../ui/icons";
import { parseApiError } from "../../lib/api";
import { getBustaPagaFileRequest, listBustasPagaRequest } from "../../lib/bustaPaga.api";
import { openPdfFromRequest, periodoLabel } from "../../lib/bustaPaga";
import { formatDateTime } from "../../lib/format";
import { FirmarBustaPagaModal } from "./FirmarBustaPagaModal";

// Seccion "Mis busta paga" del perfil del chofer: para abrir cada una tiene que firmar primero.
export const MisBustaPagaCard = () => {
  const [bustas, setBustas] = useState(null);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const load = useCallback(() => {
    listBustasPagaRequest()
      .then(setBustas)
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = async (busta) => {
    setError("");
    setOpeningId(busta.id);
    try {
      await openPdfFromRequest(() => getBustaPagaFileRequest(busta.id));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setOpeningId(null);
    }
  };

  const pendientes = bustas?.filter((b) => !b.firmada).length ?? 0;

  return (
    <GlassCard>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-500/15 text-accent-400">
            <FileTextIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold text-ink-50">Mis busta paga</h2>
            <p className="text-[12px] text-ink-400">Para abrir cada una tienes que firmar que la recibes.</p>
          </div>
        </div>
        {pendientes > 0 && (
          <span className="rounded-full bg-warning-500/20 px-3 py-1 text-[12px] font-medium text-warning-500">
            {pendientes} {pendientes === 1 ? "nueva" : "nuevas"}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Alert>{error}</Alert>
        {bustas === null && !error && <Spinner />}
        {bustas?.length === 0 && (
          <p className="text-[14px] text-ink-400">Todavia no tienes busta paga cargadas.</p>
        )}
        {bustas?.map((busta) => (
          <div key={busta.id} className="glass-surface-sm flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
            <div className="min-w-0">
              <span className="block text-[15px] font-medium text-ink-50">{periodoLabel(busta.anio, busta.mes)}</span>
              <span className="block text-[12px] text-ink-400">
                {busta.firmada ? `Firmada el ${formatDateTime(busta.firmadaAt)}` : "Pendiente de tu firma"}
              </span>
            </div>
            {busta.firmada ? (
              <Button
                variant="ghost"
                className="!w-auto px-4 py-2 text-[13px]"
                loading={openingId === busta.id}
                onClick={() => handleOpen(busta)}
              >
                Ver
              </Button>
            ) : (
              <Button className="!w-auto px-4 py-2 text-[13px]" onClick={() => setSigning(busta)}>
                Firmar y ver
              </Button>
            )}
          </div>
        ))}
      </div>

      {signing && (
        <FirmarBustaPagaModal
          busta={signing}
          onClose={() => setSigning(null)}
          onSigned={() => {
            setSigning(null);
            load();
          }}
        />
      )}
    </GlassCard>
  );
};
