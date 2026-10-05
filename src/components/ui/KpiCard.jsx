import clsx from "clsx";
import { useId } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "./icons";

// Mini-linea de tendencia (SVG puro, sin recharts: la dibujan 4 tarjetas a la vez).
const Sparkline = ({ series }) => {
  const gradientId = useId();
  if (!series || series.length < 2) return null;

  const width = 120;
  const height = 36;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const points = series.map((value, index) => [
    (index / (series.length - 1)) * width,
    height - 4 - ((value - min) / range) * (height - 8),
  ]);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="hidden h-9 w-20 shrink-0 sm:block" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// Tarjeta de indicador: icono, etiqueta, valor grande, variacion vs periodo anterior
// y mini-linea de fondo. deltaPct null = sin base de comparacion.
export const KpiCard = ({ icon: Icon, label, value, deltaPct, deltaLabel, series, className }) => {
  const positive = deltaPct != null && deltaPct >= 0;

  return (
    <div className={clsx("glass-surface flex flex-col gap-3 rounded-2xl p-4 sm:p-5", className)}>
      <div className="flex items-center gap-3">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full sm:flex bg-line/5 text-ink-300 ring-1 ring-line/10">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-[13px] font-medium text-ink-200 sm:text-[14px]">{label}</span>
      </div>

      <span className="text-[24px] font-semibold leading-none tracking-tight text-ink-50 sm:text-[30px]">{value}</span>

      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
        {deltaPct != null ? (
          <span className="flex flex-wrap items-center gap-x-1.5 text-[12px] sm:whitespace-nowrap">
            <span
              className={clsx(
                "flex items-center gap-0.5 font-semibold",
                positive ? "text-success-500" : "text-danger-500"
              )}
            >
              {positive ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
              {positive ? "+" : ""}
              {deltaPct.toFixed(1)}%
            </span>
            <span className="text-ink-400">{deltaLabel}</span>
          </span>
        ) : (
          <span className="text-[12px] text-ink-400">Sin periodo anterior</span>
        )}
        <Sparkline series={series} />
      </div>
    </div>
  );
};
