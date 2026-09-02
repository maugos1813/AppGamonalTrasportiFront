// Como setInterval, pero se pausa solo mientras la pestania esta oculta (minimizada,
// en otra pestania, laptop con la tapa cerrada) y se reanuda -con un refresco
// inmediato, para no quedar con datos viejos- apenas vuelve a estar visible. Sin
// esto, una pestania olvidada en segundo plano le sigue pegando al backend/DB para
// siempre aunque nadie la este mirando - eso es lo que mantiene Postgres (Neon)
// "despierto" y sale plata, no la cantidad de datos que trae cada pedido. Pensado
// para pantallas de solo lectura (Mapa, campanita) - NO usar para el GPS de
// choferes, que a proposito tiene que seguir mandando ubicacion aunque el chofer no
// este mirando la pantalla.
export const startVisibleInterval = (fn, intervalMs) => {
  let intervalId = null;

  const start = () => {
    if (intervalId != null) return;
    intervalId = setInterval(fn, intervalMs);
  };
  const stop = () => {
    if (intervalId == null) return;
    clearInterval(intervalId);
    intervalId = null;
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      stop();
    } else {
      fn();
      start();
    }
  };

  if (!document.hidden) start();
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
};
