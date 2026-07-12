import clsx from "clsx";
import { forwardRef, useState } from "react";

export const PasswordField = forwardRef(
  ({ label, error, className, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <label className="block" htmlFor={id}>
        {label && (
          <span className="mb-1.5 block text-[13px] font-medium text-ink-300">
            {label}
          </span>
        )}
        <div className="relative">
          <input
            id={id}
            ref={ref}
            type={visible ? "text" : "password"}
            className={clsx(
              "glass-input w-full rounded-xl px-4 py-3 pr-12 text-[15px] text-ink-50",
              error && "border-danger-500/70 focus:border-danger-500",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-4 text-[13px] font-medium text-ink-300 hover:text-ink-50"
            tabIndex={-1}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {error && <span className="mt-1.5 block text-[13px] text-danger-500">{error}</span>}
      </label>
    );
  }
);

PasswordField.displayName = "PasswordField";
