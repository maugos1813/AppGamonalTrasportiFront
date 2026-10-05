import { useSyncExternalStore } from "react";

// Texto de busqueda de Vehiculos compartido entre la barra superior (AppShell) y la
// barra de la propia pagina. Es un estado en memoria y sincronico: guardarlo en la URL
// (?q=) llegaba con retraso al campo y se perdian letras al escribir rapido.
let value = "";
const listeners = new Set();

export const setVehicleSearch = (next) => {
  value = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useVehicleSearch = () => useSyncExternalStore(subscribe, () => value);
