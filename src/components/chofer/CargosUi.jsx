import clsx from "clsx";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "../ui/icons";

// Piezas visuales de "Mis cargos" (vista del chofer): tarjetas de indicador con icono en degradado,
// paneles con cabecera y barras de los ultimos meses.

// Icono redondo con degradado del color dado (hex) y un leve brillo.
export const GlowIcon = ({ icon: Icon, color, size = "lg" }) => (
  <span
    className={clsx(
      "flex shrink-0 items-center justify-center rounded-full",
      size === "lg" ? "h-10 w-10 sm:h-14 sm:w-14" : "h-11 w-11"
    )}
    style={{
      color,
      background: `radial-gradient(circle at 30% 25%, ${color}55, ${color}1f 70%)`,
      boxShadow: `inset 0 0 0 1px ${color}55, 0 0 18px -6px ${color}`,
    }}
  >
    <Icon className={size === "lg" ? "h-5 w-5 sm:h-7 sm:w-7" : "h-5 w-5"} />
  </span>
);

export const CargoKpi = ({ to, icon, color, label, value, detail, hint, className }) => {
  const body = (
    <>
      <GlowIcon icon={icon} color={color} />
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[12px] text-ink-200 sm:text-[13px]">
          <span className="leading-tight">{label}</span>
          {hint}
        </span>
        <span className="mt-0.5 block text-[17px] font-semibold leading-tight text-ink-50 sm:text-[21px]">{value}</span>
        <span className="block truncate text-[12px] text-ink-300 sm:text-[13px]">{detail}</span>
      </div>
      {to && <ChevronRightIcon className="hidden h-5 w-5 shrink-0 text-ink-300 sm:block" />}
    </>
  );
  const cls = clsx(
    "glass-surface-sm flex items-center gap-2.5 rounded-2xl border-accent-400/20 p-3 transition-transform sm:gap-3 sm:p-4",
    className
  );
  return to ? (
    <Link to={to} className={clsx(cls, "hover:-translate-y-0.5")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
};

// Panel con icono + titulo (+ subtitulo y contenido a la derecha).
export const CargoPanel = ({ icon: Icon, title, subtitle, aside, to, children, className }) => {
  const head = (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/25">
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold leading-tight text-ink-50">{title}</h2>
        {subtitle && <p className="text-[13px] text-ink-300">{subtitle}</p>}
      </div>
    </div>
  );
  return (
    <section className={clsx("glass-surface rounded-3xl p-4 sm:p-5", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        {to ? (
          <Link to={to} className="min-w-0 flex-1">
            {head}
          </Link>
        ) : (
          head
        )}
        {aside}
      </header>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
};

// Barras de los ultimos meses: valor debajo de cada mes. rows: [{ label, value }]. El ultimo mes (el
// elegido) queda en azul oscuro si es 0.
export const BarrasMeses = ({ rows, format }) => {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex h-44 items-end gap-2 border-b border-line/10 px-1 pb-0 sm:gap-4">
      {rows.map((row) => {
        const height = row.value > 0 ? Math.max(14, Math.round((row.value / max) * 100)) : 8;
        return (
          <div key={row.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className={clsx("w-full rounded-t-md", row.value > 0 ? "bg-gradient-to-b from-brand to-brand/60" : "bg-accent-600/60")}
              style={{ height: `${height}%` }}
              title={format(row.value)}
            />
          </div>
        );
      })}
    </div>
  );
};

export const EtiquetasMeses = ({ rows, format }) => (
  <div className="mt-2 flex gap-2 px-1 sm:gap-4">
    {rows.map((row) => (
      <div key={row.label} className="min-w-0 flex-1 text-center leading-tight">
        <span className="block text-[12px] text-ink-100">{row.label}</span>
        <span className="block truncate text-[10.5px] text-ink-400">{format(row.value)}</span>
      </div>
    ))}
  </div>
);
