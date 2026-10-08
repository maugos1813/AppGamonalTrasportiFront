import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Switch } from "../ui/Switch";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { getMyGpsRespaldoRequest, setMyGpsRespaldoRequest } from "../../lib/gps.api";
import { requestLocationPermission } from "./LocationSharingBlock";

// Autorizacion del chofer para usar el GPS de su celular como respaldo. Solo se usa si el GPS del vehiculo
// esta bloqueado o caido y solo mientras tiene un servicio en curso; fuera de eso no se guarda nada.
export const GpsRespaldoBlock = () => {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const permitido = Boolean(user?.gpsRespaldoPermitido);

  useEffect(() => {
    if (!permitido) {
      setStatus(null);
      return;
    }
    getMyGpsRespaldoRequest()
      .then(setStatus)
      .catch(() => {});
  }, [permitido]);

  const handleToggle = async (checked) => {
    setSaving(true);
    setError("");
    try {
      if (checked) await requestLocationPermission();
      setUser(await setMyGpsRespaldoRequest(checked));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Alert>{error}</Alert>
      <Switch
        id="gps-respaldo"
        label="GPS de respaldo del celular"
        description="Si el GPS del vehiculo deja de funcionar, la app usa la ubicacion de tu celular solo mientras tienes un servicio en curso, para poder calcular tus paradas y pagarte lo justo. Fuera de esos casos no se guarda nada. Puedes retirarlo cuando quieras."
        checked={permitido}
        disabled={saving}
        onChange={handleToggle}
      />
      {permitido && status?.activo && (
        <p className="mt-3 rounded-xl bg-warning-500/10 px-3 py-2 text-[12px] text-warning-500">
          El GPS del vehiculo no responde: tu celular esta registrando el recorrido de tu servicio.
        </p>
      )}
      {permitido && status && !status.activo && (
        <p className="mt-3 text-[12px] text-ink-400">Ahora mismo no se esta usando: el GPS del vehiculo funciona.</p>
      )}
    </div>
  );
};
