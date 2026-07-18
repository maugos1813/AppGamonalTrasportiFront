import clsx from "clsx";
import { Spinner } from "./Spinner";

export const Button = ({
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  type = "button",
  className,
  ...props
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={clsx(
      "inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-medium transition-all duration-200 focus:outline-none focus-visible:ring-4",
      "disabled:cursor-not-allowed disabled:opacity-60",
      variant === "primary" &&
        "bg-brand-yellow text-brand-navy shadow-[0_4px_20px_-4px_rgba(255,208,0,0.45)] hover:brightness-95 focus-visible:ring-brand-yellow/40 active:scale-[0.98]",
      variant === "ghost" &&
        "glass-surface-sm text-ink-50 hover:bg-line/10 focus-visible:ring-line/20 active:scale-[0.98]",
      variant === "danger" &&
        "bg-danger-500 text-white hover:brightness-95 focus-visible:ring-danger-500/30 active:scale-[0.98]",
      variant === "link" &&
        "w-auto rounded-md px-0 py-0 text-accent-400 hover:text-accent-300",
      className
    )}
    {...props}
  >
    {loading && <Spinner />}
    {children}
  </button>
);
