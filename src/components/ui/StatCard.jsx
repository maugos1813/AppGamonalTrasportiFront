import clsx from "clsx";

const TONE_CLASSES = {
  default: "text-ink-50",
  amber: "text-amber-300",
  blue: "text-accent-300",
  green: "text-[#4ddb6e]",
  red: "text-[#ff6961]",
};

export const StatCard = ({ label, value, sublabel, tone = "default", className }) => (
  <div className={clsx("glass-surface-sm rounded-xl px-4 py-4", className)}>
    <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className={clsx("mt-1 block text-[24px] font-semibold", TONE_CLASSES[tone])}>
      {value}
    </span>
    {sublabel && <span className="mt-0.5 block text-[12px] text-ink-400">{sublabel}</span>}
  </div>
);
