import clsx from "clsx";

// Atajos de destino (ver DESTINO_SUGERENCIAS): al elegir uno se rellena la direccion y queda su ubicacion exacta.
// `lat`/`lng` = la ubicacion exacta guardada ahora, para marcar el atajo elegido.
export const DestinoSugerencias = ({ sugerencias, lat, lng, onPick, disabled, className }) => {
  if (!sugerencias?.length) return null;
  return (
    <div className={clsx("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-[12px] text-ink-400">Sugerencias:</span>
      {sugerencias.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className={clsx(
            "rounded-full px-3 py-1 text-[12px] font-medium transition-colors disabled:opacity-50",
            lat === s.lat && lng === s.lng
              ? "bg-accent-500/20 text-accent-400"
              : "glass-surface-sm text-ink-200 hover:bg-line/10"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
};
