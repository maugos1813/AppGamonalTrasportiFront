// Anillo de progreso (dona con el valor en el centro), inspirado en las mini-cards
// de la referencia de dashboard que paso el usuario. "percent" solo controla cuanto
// se llena el anillo (0-100, se recorta afuera de ese rango); "value"/"label"/
// "sublabel" son el texto libre que se muestra, no tienen que coincidir con percent.
export const ProgressRing = ({ value, label, sublabel, percent, color, size = 96, strokeWidth = 9 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl glass-surface-sm px-4 py-5 text-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-line/10"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-2">
          <span className="text-[13px] font-semibold leading-tight text-ink-50">{value}</span>
        </div>
      </div>

      <div>
        <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
        {sublabel && <span className="mt-0.5 block text-[11px] text-ink-300">{sublabel}</span>}
      </div>
    </div>
  );
};
