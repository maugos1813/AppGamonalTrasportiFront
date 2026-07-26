import { createContext, useCallback, useContext, useMemo, useState } from "react";

const DataRefreshContext = createContext(null);

const INITIAL_VERSIONS = { records: 0, drivers: 0, vehicles: 0 };

// Las listas (Registros/Choferes/Vehiculos) quedan montadas de fondo mientras se
// crea/edita/borra un registro en el overlay superpuesto (ver App.jsx) - por eso ya
// no se remontan solas al volver, y perdieron la costumbre "accidental" de traer
// datos frescos que eso daba. Este contexto la reemplaza a proposito: quien hace el
// cambio llama a refresh(domain) al terminar, y la lista de ese dominio (que escucha
// su version) vuelve a pedir sus datos - sin refetchear nada si no cambio nada.
export const DataRefreshProvider = ({ children }) => {
  const [versions, setVersions] = useState(INITIAL_VERSIONS);

  const bump = useCallback((domain) => {
    setVersions((prev) => ({ ...prev, [domain]: prev[domain] + 1 }));
  }, []);

  const value = useMemo(() => ({ versions, bump }), [versions, bump]);

  return <DataRefreshContext.Provider value={value}>{children}</DataRefreshContext.Provider>;
};

// version: numero que cambia cada vez que algo de ese dominio se creo/edito/borro -
// se usa como dependencia de los effects de fetch de una lista para que se disparen
// de nuevo. refresh: llamar despues de un create/update/delete exitoso de ese dominio.
export const useDataRefresh = (domain) => {
  const ctx = useContext(DataRefreshContext);
  return { version: ctx.versions[domain], refresh: () => ctx.bump(domain) };
};
