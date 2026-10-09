import clsx from "clsx";
import { AREA_ACCESS_OPTIONS } from "../../lib/roles";

// Checkboxes de las areas de servicio a las que accede un Responsable.
export const AreaCheckboxes = ({ value, onChange, disabled }) => {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {AREA_ACCESS_OPTIONS.map((area) => {
        const checked = value.includes(area.key);
        return (
          <label
            key={area.key}
            className={clsx(
              "flex cursor-pointer items-center gap-2.5 rounded-xl glass-input px-4 py-2.5 text-[14px] text-ink-50 transition-colors",
              checked && "ring-1 ring-accent-400/60",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(area.key)}
              className="h-4 w-4 accent-[var(--accent-400)]"
            />
            {area.label}
          </label>
        );
      })}
    </div>
  );
};
