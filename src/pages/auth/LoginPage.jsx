import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PasswordField } from "../../components/ui/PasswordField";
import { TextField } from "../../components/ui/TextField";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { GlassCard } from "../../components/ui/GlassCard";
import { useAuth } from "../../context/AuthContext";

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ correoElectronico: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});
    setLoading(true);

    const result = await login(form);

    setLoading(false);

    if (!result.ok) {
      setFormError(result.error.message);
      setFieldErrors(result.error.fieldErrors || {});
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <AuthLayout title="Bienvenido" subtitle="Inicia sesion en Gamonal Trasporti">
      <GlassCard>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {location.state?.resetSuccess && (
            <Alert variant="success">
              Tu contrasena se actualizo correctamente. Inicia sesion con tus nuevos datos.
            </Alert>
          )}
          <Alert>{formError}</Alert>

          <TextField
            id="correoElectronico"
            label="Correo electronico"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={form.correoElectronico}
            onChange={handleChange("correoElectronico")}
            error={fieldErrors.correoElectronico?.[0]}
            required
          />

          <div>
            <PasswordField
              id="password"
              label="Contrasena"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange("password")}
              error={fieldErrors.password?.[0]}
              required
            />
            <div className="mt-2 text-right">
              <Link
                to="/forgot-password"
                className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
              >
                Olvidaste tu contrasena?
              </Link>
            </div>
          </div>

          <Button type="submit" loading={loading}>
            Iniciar sesion
          </Button>
        </form>
      </GlassCard>

      <p className="mt-6 text-center text-[14px] text-ink-300">
        No tienes cuenta?{" "}
        <Link to="/register" className="font-medium text-accent-400 hover:text-accent-300">
          Crea una
        </Link>
      </p>
    </AuthLayout>
  );
};
