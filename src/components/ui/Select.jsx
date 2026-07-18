import clsx from "clsx";
import { forwardRef } from "react";

export const Select = forwardRef(
  ({ label, error, className, id, options, placeholder, ...props }, ref) => (
    <label className="block" htmlFor={id}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-ink-300">
          {label}
        </span>
      )}
      <select
        id={id}
        ref={ref}
        className={clsx(
          "glass-input w-full appearance-none rounded-xl px-4 py-3 text-[15px] text-ink-50",
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%238e8e93%22><path d=%22M5.5 7.5l4.5 4.5 4.5-4.5%22 stroke=%22%238e8e93%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10",
          error && "border-danger-500/70 focus:border-danger-500",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="bg-popover text-ink-400">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-popover text-ink-50">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1.5 block text-[13px] text-danger-500">{error}</span>}
    </label>
  )
);

Select.displayName = "Select";
