import clsx from "clsx";

export const Spinner = ({ className }) => (
  <span
    className={clsx(
      "inline-block h-4 w-4 animate-spin rounded-full border-2 border-line/30 border-t-line",
      className
    )}
  />
);
