import clsx from "clsx";
import { RouteIcon } from "../ui/icons";
import { nivelLabel } from "../../lib/roles";

const km = (value) => `${Math.round(value).toLocaleString("es-AR")} km`;

// Dias que quedan del mes (contando hoy), en hora de Roma.
const daysLeftInMonth = (month) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  if (!today.startsWith(month)) return 0;
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1;
};

// "Mi meta del mes": km hechos contra la meta de su nivel (Novato / Master / Senior).
export const MetaKmCard = ({ progress }) => {
  if (!progress?.nivel) return null;
  const { meta, km: done, porcentaje, faltan, cumplida } = progress;
  const left = daysLeftInMonth(progress.month);
  const perDay = meta && !cumplida && left > 0 ? faltan / left : null;
  const pct = Math.min(100, porcentaje ?? 0);

  return (
    <section className="glass-surface rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-[18px] font-semibold text-ink-50">
          <RouteIcon className="h-6 w-6 text-accent-400" />
          Mi meta del mes
        </h2>
        <span className="rounded-full bg-accent-500/15 px-3 py-1 text-[12px] font-semibold text-accent-300">
          {nivelLabel(progress.nivel)}
        </span>
      </div>

      {meta ? (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <span className="text-[28px] font-semibold leading-none text-ink-50">
              {km(done)} <span className="text-[16px] font-normal text-ink-400">de {km(meta)}</span>
            </span>
            <span className={clsx("text-[20px] font-semibold", cumplida ? "text-success-500" : "text-accent-300")}>
              {porcentaje}%
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-line/15">
            <div
              className={clsx("h-full rounded-full transition-all", cumplida ? "bg-success-500" : "bg-accent-400")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-3 text-[13px] text-ink-300">
            {cumplida
              ? "¡Meta cumplida! Todo lo que hagas de ahora es extra."
              : perDay
                ? `Te faltan ${km(faltan)}: unos ${km(perDay)} por dia en los ${left} dias que quedan.`
                : `Te faltan ${km(faltan)}.`}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[14px] text-ink-300">
          Llevas {km(done)} este mes. La meta de tu nivel todavia no esta definida.
        </p>
      )}
    </section>
  );
};
