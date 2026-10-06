import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MancatoForm } from "../../components/mancato/MancatoForm";
import { GlassCard } from "../../components/ui/GlassCard";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { createMancatoRequest } from "../../lib/mancato.api";

export const NewMancatoPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useDataRefresh("mancato");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (fields, files) => {
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const mancato = await createMancatoRequest(fields, files);
      refresh();
      // Se preserva backgroundLocation (ver App.jsx) para que el detalle tambien se
      // muestre como overlay sobre la lista.
      navigate(`/mancato-pagamento/${mancato.id}`, {
        replace: true,
        state: { backgroundLocation: location.state?.backgroundLocation },
      });
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOverPanel closeTo="/mancato-pagamento">
      <div className="flex flex-col gap-6">
        <div>
          <Link to="/mancato-pagamento" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Mancato Pagamento
          </Link>
        </div>

        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Nuevo Mancato Pagamento</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            Se puede pagar hasta el dia 15 posterior a la fecha, como dice el aviso.
          </p>
        </div>

        <GlassCard>
          <MancatoForm
            mode="create"
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
            fieldErrors={fieldErrors}
          />
        </GlassCard>
      </div>
    </SlideOverPanel>
  );
};
