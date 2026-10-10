import { useEffect, useState } from "react";
import { getTarifasKmRequest } from "../lib/finanzas.api";

// Tarifas por km vigentes ({ AUTO_FURGONCINO, H1_L1, H2_L2, CASONATO, DHL_AB }) para sugerir el precio por km en los
// formularios. null mientras carga (o si no se pudo leer: el precio queda para escribirlo a mano).
export const useTarifasKm = () => {
  const [tarifas, setTarifas] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getTarifasKmRequest()
      .then((t) => !cancelled && setTarifas(t))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return tarifas;
};
