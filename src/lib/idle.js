// Para diferir trabajo que no hace falta apenas se monta un componente (fetches de
// background, reportes) hasta que el navegador este libre, y asi no le compita
// conexion/CPU a lo que si bloquea el primer pintado. requestIdleCallback no existe en
// Safari/WKWebView (iOS, via Capacitor) - ahi cae al setTimeout de siempre.
export const scheduleIdle = (fn) =>
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 300);

export const cancelIdle = (id) => {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};
