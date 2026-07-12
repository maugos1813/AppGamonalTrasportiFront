import clsx from "clsx";

export const GlassCard = ({ children, className, ...props }) => (
  <div
    className={clsx("glass-surface rounded-3xl p-8 sm:p-10", className)}
    {...props}
  >
    {children}
  </div>
);
