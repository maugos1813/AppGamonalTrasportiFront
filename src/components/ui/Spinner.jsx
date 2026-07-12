import clsx from "clsx";

export const Spinner = ({ className }) => (
  <span
    className={clsx(
      "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white",
      className
    )}
  />
);
