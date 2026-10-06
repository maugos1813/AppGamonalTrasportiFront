import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { MultaForm } from "../../components/multas/MultaForm";
import { GlassCard } from "../../components/ui/GlassCard";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { createMultaRequest } from "../../lib/multas.api";

export const NewMultaPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { refresh } = useDataRefresh("multas");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Cargar multas es solo de la oficina; el chofer solo las consulta.
  if (user?.cargo !== "OWNER" && user?.cargo !== "ADMIN") return <Navigate to="/multas" replace />;

  const handleSubmit = async (fields, files) => {
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const multa = await createMultaRequest(fields, files);
      refresh();
      // Se preserva backgroundLocation (ver App.jsx) para que el detalle tambien se
      // muestre como overlay sobre la lista.
      navigate(`/multas/${multa.id}`, {
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
    <SlideOverPanel closeTo="/multas">
      <div className="flex flex-col gap-6">
        <div>
          <Link to="/multas" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Multas
          </Link>
        </div>

        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Nueva multa</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            Carga los datos del verbale y sube la foto o el PDF de la multa.
          </p>
        </div>

        <GlassCard>
          <MultaForm
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
