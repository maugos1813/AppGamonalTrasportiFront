import clsx from "clsx";

export const Alert = ({ variant = "error", children }) => {
  if (!children) return null;

  return (
    <div
      role="alert"
      className={clsx(
        "rounded-xl border px-4 py-3 text-[14px] leading-snug",
        variant === "error" && "border-danger-500/30 bg-danger-500/10 text-danger-500",
        variant === "success" && "border-success-500/30 bg-success-500/10 text-success-500"
      )}
    >
      {children}
    </div>
  );
};
