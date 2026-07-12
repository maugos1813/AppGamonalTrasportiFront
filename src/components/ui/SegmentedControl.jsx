import clsx from "clsx";

export const SegmentedControl = ({ options, value, onChange, className }) => (
  <div className={clsx("inline-flex items-center gap-1 rounded-full glass-surface-sm p-1", className)}>
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={clsx(
          "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
          value === opt.value ? "bg-white/15 text-ink-50" : "text-ink-300 hover:text-ink-50"
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);
