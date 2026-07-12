import clsx from "clsx";

export const Switch = ({ id, label, description, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      {label && (
        <label htmlFor={id} className="block text-[14px] font-medium text-ink-50">
          {label}
        </label>
      )}
      {description && <p className="mt-0.5 text-[12px] text-ink-400">{description}</p>}
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-success-500/30",
        checked ? "bg-success-500" : "bg-white/15",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <span
        className={clsx(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  </div>
);
