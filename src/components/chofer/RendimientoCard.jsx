import clsx from "clsx";
import { nivelLabel } from "../../lib/roles";
import { BulbIcon, RouteIcon, ShieldIcon, TrendIcon, TruckIcon } from "../ui/icons";

const km = (value) => `${Math.round(value).toLocaleString("es-AR")} km`;

// Dias que quedan del mes (contando hoy), en hora de Roma.
const daysLeftInMonth = (month) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  if (!month || !today.startsWith(month)) return 0;
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1;
};

// Color del estilo de manejo: baja del verde al rojo pasando por amarillo y naranja sin saltos. Puntos
// (porcentaje, tono HSL) entre los que se interpola; hasta 40 es rojo, 60 naranja y desde 80 verde.
const STYLE_STOPS = [
  [0, 2],
  [40, 8],
  [60, 30],
  [72, 62],
  [82, 115],
  [92, 132],
  [100, 140],
];

export const styleColor = (value) => {
  const pct = Math.max(0, Math.min(100, value));
  let hue = STYLE_STOPS[STYLE_STOPS.length - 1][1];
  for (let i = 1; i < STYLE_STOPS.length; i += 1) {
    const [p1, h1] = STYLE_STOPS[i];
    if (pct <= p1) {
      const [p0, h0] = STYLE_STOPS[i - 1];
      hue = h0 + ((h1 - h0) * (pct - p0)) / (p1 - p0);
      break;
    }
  }
  return `${Math.round(hue)} 82% 52%`;
};

const styleVerdict = (value) => {
  if (value >= 85) return "Excelente";
  if (value >= 75) return "Bueno";
  if (value >= 50) return "Regular";
  return "A mejorar";
};

// Consejos de uso general: cuando no hay nada mas especifico que decirle, uno distinto cada dia.
const GENERAL_TIPS = [
  "Al terminar cada servicio, declara tus peajes y el carburante: no te quedan avisos en rojo.",
  "Mira el trafico antes de salir: salir 10 minutos antes evita el apuro y las frenadas fuertes.",
  "Mantén la distancia con el de adelante: frenar suave cuida el vehículo y tu estilo de manejo.",
  "Carga las horas apenas termines el servicio: se aprueban y se pagan antes.",
  "Revisa presion de neumaticos y luces al empezar el dia: un minuto que evita problemas en ruta.",
];

const dayOfYear = () => {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
};

// Lo mas util para este chofer hoy, segun sus datos: primero el manejo, luego el ritmo de su meta.
const buildTip = ({ estilo, meta, cumplida, faltan, left }) => {
  if (estilo != null && estilo < 70) {
    return "Anticipa los frenos y acelera de a poco: es lo que mas sube tu porcentaje de manejo.";
  }
  if (meta && !cumplida && left > 0 && faltan > 0) {
    return `Para llegar a tu meta necesitas unos ${km(faltan / left)} por dia en los ${left} dias que quedan.`;
  }
  if (meta && cumplida) return "¡Meta cumplida! Todo lo que hagas de ahora es extra. Sigue con manejo suave.";
  return GENERAL_TIPS[dayOfYear() % GENERAL_TIPS.length];
};

const Tile = ({ label, icon: Icon, accent, children, className }) => (
  <div
    className={clsx("flex min-w-0 flex-col justify-between gap-2 rounded-2xl border bg-line/[0.03] px-3.5 py-3.5", className)}
    style={accent ? { borderColor: `hsl(${accent} / 0.45)` } : undefined}
  >
    <div className="flex items-center gap-2">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={accent ? { backgroundColor: `hsl(${accent} / 0.15)`, color: `hsl(${accent})` } : undefined}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="text-[10.5px] font-medium uppercase tracking-normal text-ink-300">{label}</span>
    </div>
    {children}
  </div>
);

const ProgressBar = ({ pct, color }) => (
  <div className="h-2 overflow-hidden rounded-full bg-line/15">
    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: `hsl(${color})` }} />
  </div>
);

// "Mi rendimiento": avance de la meta de km, km del mes, estilo de manejo (OneSystec, de los ultimos dias) y
// un consejo. `estilo` = { puntaje 1-100, dias, calculando } o null mientras carga o si no hay datos. Sale solo de
// las jornadas del propio chofer (no del vehiculo entero, que otros tambien manejan).
export const RendimientoCard = ({ progress, estilo: estiloData }) => {
  if (!progress) return null;

  const { meta, km: done, porcentaje, faltan, cumplida, nivel, month } = progress;
  const estilo = typeof estiloData?.puntaje === "number" ? Math.round(estiloData.puntaje) : null;
  const left = daysLeftInMonth(month);
  const goalColor = cumplida ? "142 70% 45%" : "212 90% 60%";
  const tip = buildTip({ estilo, meta, cumplida, faltan, left });
  const styleHsl = estilo != null ? styleColor(estilo) : null;

  return (
    <section className="glass-surface rounded-3xl p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-[20px] font-semibold text-ink-50">
          <TrendIcon className="h-6 w-6 text-accent-400" />
          Mi rendimiento
        </h2>
        {nivel && (
          <span className="rounded-full bg-accent-500/15 px-3 py-1 text-[12px] font-semibold text-accent-300">
            {nivelLabel(nivel)}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tile label="Mi meta" icon={RouteIcon} accent={goalColor}>
          {meta ? (
            <>
              <span className="text-[30px] font-semibold leading-none" style={{ color: `hsl(${goalColor})` }}>
                {porcentaje}%
              </span>
              <ProgressBar pct={Math.min(100, porcentaje ?? 0)} color={goalColor} />
              <span className="text-[12px] text-ink-300">{cumplida ? "¡Cumplida!" : `de ${km(meta)} este mes`}</span>
            </>
          ) : (
            <>
              <span className="text-[30px] font-semibold leading-none text-ink-400">—</span>
              <span className="text-[12px] text-ink-300">Tu meta todavía no está definida</span>
            </>
          )}
        </Tile>

        <Tile label="Km del mes" icon={TruckIcon} accent="212 90% 60%">
          <span className="text-[30px] font-semibold leading-none text-accent-300">{Math.round(done).toLocaleString("es-AR")}</span>
          <span className="text-[12px] text-ink-300">
            {meta && !cumplida ? `faltan ${km(faltan)}` : "kilómetros recorridos"}
          </span>
        </Tile>

        <Tile label="Estilo de manejo" icon={ShieldIcon} accent={styleHsl}>
          {estilo != null ? (
            <>
              <span className="text-[30px] font-semibold leading-none" style={{ color: `hsl(${styleHsl})` }}>
                {estilo}%
              </span>
              <ProgressBar pct={estilo} color={styleHsl} />
              <span className="text-[12px] font-medium" style={{ color: `hsl(${styleHsl})` }}>
                {styleVerdict(estilo)} · {estiloData.dias} días
              </span>
            </>
          ) : (
            <>
              <span className="text-[30px] font-semibold leading-none text-ink-400">—</span>
              <span className="text-[12px] text-ink-300">
                {estiloData?.calculando
                  ? "Calculando tu manejo…"
                  : "Se calcula con las horas de tus servicios"}
              </span>
            </>
          )}
        </Tile>

        <Tile label="Consejo" icon={BulbIcon} accent="45 95% 55%">
          <p className="text-[13px] leading-snug text-ink-50">{tip}</p>
        </Tile>
      </div>
    </section>
  );
};
