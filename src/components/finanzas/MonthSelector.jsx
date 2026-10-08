import { currentMonth, monthName, shiftMonth } from "../../lib/finanzas";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";

// Selector de mes con flechas. No deja ir mas alla del mes en curso, salvo allowFuture.
export const MonthSelector = ({ month, onChange, allowFuture = false }) => {
  const isCurrent = !allowFuture && month >= currentMonth();
  const buttonClass =
    "flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50 disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="glass-surface-sm flex items-center justify-between gap-1 rounded-xl px-1.5 py-1">
      <button
        type="button"
        aria-label="Mes anterior"
        className={buttonClass}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      <span className="min-w-[132px] text-center text-[14px] font-medium capitalize text-ink-50">
        {monthName(month)}
      </span>
      <button
        type="button"
        aria-label="Mes siguiente"
        className={buttonClass}
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
};
