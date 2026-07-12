import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { GlassCard } from "../../components/ui/GlassCard";
import { parseApiError } from "../../lib/api";
import { forgotPasswordRequest } from "../../lib/auth.api";

export const ForgotPasswordPage = () => {
  const [correoElectronico, setCorreoElectronico] = useState("");
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);

    try {
      await forgotPasswordRequest(correoElectronico);
      setSent(true);
    } catch (error) {
      setFormError(parseApiError(error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperar acceso"
      subtitle="Te enviaremos un enlace para restablecer tu contrasena"
    >
      <GlassCard>
        {sent ? (
          <Alert variant="success">
            Si el correo existe en nuestro sistema, recibiras un enlace para restablecer tu
            contrasena en unos minutos.
          </Alert>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <Alert>{formError}</Alert>

            <TextField
              id="correoElectronico"
              label="Correo electronico"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={correoElectronico}
              onChange={(e) => setCorreoElectronico(e.target.value)}
              required
            />

            <Button type="submit" loading={loading}>
              Enviar enlace
            </Button>
          </form>
        )}
      </GlassCard>

      <p className="mt-6 text-center text-[14px] text-ink-300">
        <Link to="/login" className="font-medium text-accent-400 hover:text-accent-300">
          Volver a iniciar sesion
        </Link>
      </p>
    </AuthLayout>
  );
};
