import clsx from "clsx";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "./icons";

// Tarjeta de la columna derecha de las listas: icono + titulo (+ dato a la derecha).
export const PanelShell = ({ icon: Icon, title, aside, children, className }) => (
  <section className={clsx("glass-surface rounded-2xl p-5", className)}>
    <header className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-ink-300" />
        <h2 className="text-[15px] font-semibold text-ink-50">{title}</h2>
      </div>
      {aside}
    </header>
    {children}
  </section>
);

const TONE_DOT = { danger: "bg-danger-500 shadow-[0_0_8px_var(--danger-500)]", warning: "bg-warning-500 shadow-[0_0_8px_var(--warning-500)]" };
const TONE_BAR = { danger: "border-l-danger-500", warning: "border-l-warning-500" };

// Grupo de avisos dentro de "Atencion requerida": titulo con contador y una fila por
// aviso (tone: danger/warning; to/state: a donde lleva; title/detail: texto).
export const AttentionGroup = ({ title, items }) =>
  items.length === 0 ? null : (
    <div>
      <h3 className="mb-1.5 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-ink-400">
        {title}
        <span className="rounded-full bg-line/10 px-1.5 text-[11px] text-ink-200">{items.length}</span>
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              state={item.state}
              className={clsx(
                "flex items-center gap-2.5 rounded-xl border border-l-[3px] border-line/[0.07] px-3 py-2.5 text-[13px] transition-colors hover:bg-line/[0.05]",
                TONE_BAR[item.tone]
              )}
            >
              <span className={clsx("h-2 w-2 shrink-0 rounded-full", TONE_DOT[item.tone])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink-50">{item.title}</span>
                {item.detail && <span className="block truncate text-[12px] text-ink-400">{item.detail}</span>}
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-500" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
