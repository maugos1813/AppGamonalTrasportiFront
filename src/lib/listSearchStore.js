import { useSyncExternalStore } from "react";

// Texto de busqueda de las listas (Vehiculos, Choferes) compartido entre la barra
// superior (AppShell) y la barra de la propia pagina. Es un estado en memoria y
// sincronico: guardarlo en la URL (?q=) llegaba con retraso al campo y se perdian
// letras al escribir rapido. Solo una lista esta montada a la vez, asi que alcanza con
// un unico valor; cada pagina lo limpia al desmontarse.
let value = "";
const listeners = new Set();

export const setListSearch = (next) => {
  value = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useListSearch = () => useSyncExternalStore(subscribe, () => value);
