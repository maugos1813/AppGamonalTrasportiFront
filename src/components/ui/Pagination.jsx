import clsx from "clsx";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

// Numeros de pagina a mostrar: todos si son pocos; si no, primera, ultima y las
// vecinas de la actual con "…" en los saltos.
const pageNumbers = (current, count) => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["…", p] : [p]));
};

const ARROW =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-line/10 text-ink-200 transition-colors enabled:hover:bg-line/10 disabled:opacity-40";

// noun: lo que se esta listando en plural ("vehículos", "choferes").
export const Pagination = ({ page, pageCount, pageSize, total, noun, onChange }) => {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-ink-400">
        Mostrando {from} - {to} de {total} {noun}
      </p>
      {pageCount > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-1.5">
          <button type="button" className={ARROW} disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          {pageNumbers(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-ink-500">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={clsx(
                  "h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium transition-colors",
                  p === page ? "bg-accent-500 text-white" : "border border-line/10 text-ink-200 hover:bg-line/10"
                )}
              >
                {p}
              </button>
            )
          )}
          <button type="button" className={ARROW} disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label="Página siguiente">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
};
