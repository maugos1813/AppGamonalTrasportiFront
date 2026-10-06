// Como setInterval, pero se pausa solo cuando nadie esta mirando la pantalla, y se
// reanuda -con un refresco inmediato, para no quedar con datos viejos- apenas vuelve
// la actividad. Sin esto, una pestania olvidada le sigue pegando al backend/DB para
// siempre aunque nadie la este usando - eso es lo que mantiene Postgres (Neon)
// "despierto" y sale plata (se cobra por hora despierta, no por la cantidad de datos
// que trae cada pedido). Pensado para pantallas de solo lectura (Mapa, campanita) - NO
// usar para el GPS de choferes, que a proposito tiene que seguir mandando ubicacion
// aunque el chofer no este mirando la pantalla.
//
// Se pausa cuando:
//  - la pestania esta oculta (minimizada, en otra pestania, laptop con la tapa cerrada);
//  - hay inactividad: pestania visible pero sin mouse/teclado/toque/scroll durante
//    idleMs (monitor con la app abierta y nadie delante);
//  - fuera del horario laboral (ver isWorkingHours) el limite de inactividad baja a
//    OFF_HOURS_IDLE_MS: no se corta del todo porque hay servicios de noche y alguien
//    puede estar mirando el Mapa, pero una pestania olvidada de noche se apaga rapido.

const DEFAULT_IDLE_MS = 5 * 60 * 1000;
const OFF_HOURS_IDLE_MS = 2 * 60 * 1000;

const WORK_TIME_ZONE = "Europe/Rome";
const WORK_START_HOUR = 7;
const WORK_END_HOUR = 20;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"];

// Lunes a sabado de 7:00 a 20:00 hora de Roma (la operacion trabaja ahi, no en la hora
// del navegador de quien mire).
export const isWorkingHours = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WORK_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return weekday !== "Sun" && hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
};

export const startVisibleInterval = (fn, intervalMs, { idleMs = DEFAULT_IDLE_MS } = {}) => {
  let intervalId = null;
  let lastActivity = Date.now();
  let pausedByIdle = false;

  const isIdle = () =>
    Date.now() - lastActivity > (isWorkingHours() ? idleMs : Math.min(idleMs, OFF_HOURS_IDLE_MS));

  const tick = () => {
    if (isIdle()) {
      pausedByIdle = true;
      return;
    }
    fn();
  };

  const start = () => {
    if (intervalId != null) return;
    intervalId = setInterval(tick, intervalMs);
  };
  const stop = () => {
    if (intervalId == null) return;
    clearInterval(intervalId);
    intervalId = null;
  };

  const onActivity = () => {
    lastActivity = Date.now();
    if (pausedByIdle) {
      pausedByIdle = false;
      fn();
    }
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      stop();
    } else {
      lastActivity = Date.now();
      pausedByIdle = false;
      fn();
      start();
    }
  };

  if (!document.hidden) start();
  document.addEventListener("visibilitychange", onVisibilityChange);
  ACTIVITY_EVENTS.forEach((name) =>
    window.addEventListener(name, onActivity, { passive: true, capture: true })
  );

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    ACTIVITY_EVENTS.forEach((name) =>
      window.removeEventListener(name, onActivity, { capture: true })
    );
  };
};
