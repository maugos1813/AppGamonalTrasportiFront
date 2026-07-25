import clsx from "clsx";
import { forwardRef } from "react";

export const TextField = forwardRef(
  // className: layout del campo dentro de su contenedor (flex-1, sm:w-28, col-span,
  // max-w-sm, etc.) - va en el <label>, que es el verdadero hijo del contenedor
  // flex/grid. Antes se mezclaba en el <input> interno, que no es el hijo flex/grid
  // real: el label (sin ninguna clase de tamano) se encogia a su contenido y el
  // input quedaba atrapado en ese espacio minusculo aunque el tuviera "flex-1" o
  // "w-full" (bug visible en el campo de direccion de StopListEditor).
  ({ label, error, className, id, ...props }, ref) => (
    <label className={clsx("block", className)} htmlFor={id}>
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
          error && "border-danger-500/70 focus:border-danger-500"
        )}
        {...props}
      />
      {error && <span className="mt-1.5 block text-[13px] text-danger-500">{error}</span>}
    </label>
  )
);

TextField.displayName = "TextField";
