import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CombustibleForm } from "../../components/combustible/CombustibleForm";
import { GlassCard } from "../../components/ui/GlassCard";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { createCombustibleRequest } from "../../lib/combustible.api";

export const NewCombustiblePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useDataRefresh("combustible");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (fields, files) => {
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const registro = await createCombustibleRequest(fields, files);
      refresh();
      // Se preserva backgroundLocation (ver App.jsx) para que el detalle tambien se
      // muestre como overlay sobre la lista.
      navigate(`/finanzas/combustible/${registro.id}`, {
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
    <SlideOverPanel closeTo="/finanzas/combustible">
      <div className="flex flex-col gap-6">
        <div>
          <Link to="/finanzas/combustible" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Registro Combustible
          </Link>
        </div>

        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Nueva carga de combustible</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            Sube la foto del comprobante y completa los datos. Podras corregirlos hasta el final del dia.
          </p>
        </div>

        <GlassCard>
          <CombustibleForm
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
