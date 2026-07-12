import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PasswordField } from "../../components/ui/PasswordField";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { GlassCard } from "../../components/ui/GlassCard";
import { parseApiError } from "../../lib/api";
import { resetPasswordRequest } from "../../lib/auth.api";

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!token) {
      setFormError("El enlace de recuperacion no es valido. Solicita uno nuevo.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("Las contrasenas no coinciden");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordRequest(token, newPassword);
      navigate("/login", {
        replace: true,
        state: { resetSuccess: true },
      });
    } catch (error) {
      setFormError(parseApiError(error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Nueva contrasena" subtitle="Elige una nueva contrasena para tu cuenta">
      <GlassCard>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <Alert>{formError}</Alert>

          <PasswordField
            id="newPassword"
            label="Nueva contrasena"
            autoComplete="new-password"
            placeholder="Minimo 8 caracteres"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <PasswordField
            id="confirmPassword"
            label="Confirmar contrasena"
            autoComplete="new-password"
            placeholder="Repite la contrasena"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" loading={loading}>
            Restablecer contrasena
          </Button>
        </form>
      </GlassCard>

      <p className="mt-6 text-center text-[14px] text-ink-300">
        <Link to="/login" className="font-medium text-accent-400 hover:text-accent-300">
          Volver a iniciar sesion
        </Link>
      </p>
    </AuthLayout>
  );
};
