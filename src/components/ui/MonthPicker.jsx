import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Selector de mes (‹ Septiembre 2026 ›). value = { year, month (1-12) }; onChange recibe
// el valor nuevo ya calculado.
export const MonthPicker = ({ value, onChange }) => {
  const shift = (delta) => {
    const d = new Date(Date.UTC(value.year, value.month - 1 + delta, 1));
    onChange({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };

  return (
    <div className="glass-surface-sm flex items-center gap-1 rounded-xl px-1.5 py-1">
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => shift(-1)}
        className="rounded-lg p-1.5 text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      <span className="flex min-w-[9.5rem] items-center justify-center gap-2 px-1 text-[14px] font-medium text-ink-50">
        <CalendarIcon className="h-4 w-4 text-ink-300" />
        {MONTH_NAMES[value.month - 1]} {value.year}
      </span>
      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={() => shift(1)}
        className="rounded-lg p-1.5 text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
};
