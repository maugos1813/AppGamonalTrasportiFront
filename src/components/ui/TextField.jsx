import clsx from "clsx";
import { forwardRef } from "react";

export const TextField = forwardRef(
  ({ label, error, className, id, ...props }, ref) => (
    <label className="block" htmlFor={id}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-ink-300">
          {label}
        </span>
      )}
      <input
        id={id}
        ref={ref}
        className={clsx(
          "glass-input w-full rounded-xl px-4 py-3 text-[15px] text-ink-50",
          error && "border-danger-500/70 focus:border-danger-500",
          className
        )}
        {...props}
      />
      {error && <span className="mt-1.5 block text-[13px] text-danger-500">{error}</span>}
    </label>
  )
);

TextField.displayName = "TextField";
