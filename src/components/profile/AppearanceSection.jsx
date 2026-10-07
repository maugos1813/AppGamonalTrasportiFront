import clsx from "clsx";
import { useTheme } from "../../context/ThemeContext";
import { PALETTES } from "../../lib/themes";
import { CheckCircleIcon, MoonIcon, SunIcon } from "../ui/icons";

const MODES = [
  { id: "light", label: "Claro", icon: SunIcon },
  { id: "dark", label: "Oscuro", icon: MoonIcon },
];

// Muestras de la paleta como pastillas verticales (misma idea que la referencia).
const Swatches = ({ colors }) => (
  <div className="flex gap-1.5" aria-hidden="true">
    {colors.map((color) => (
      <span key={color} className="h-9 flex-1 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} />
    ))}
  </div>
);

// Selector de apariencia: modo (claro/oscuro) + paleta de color. Son ejes
// independientes: cualquier paleta existe en modo claro y en modo oscuro. Se
// guarda en este dispositivo (localStorage), no en la cuenta.
export const AppearanceSection = () => {
  const { theme, setTheme, palette, setPalette } = useTheme();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-400">Modo</p>
        <div role="radiogroup" aria-label="Modo" className="grid grid-cols-2 gap-2.5">
          {MODES.map(({ id, label, icon: Icon }) => {
            const selected = theme === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(id)}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[14px] font-medium transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/30",
                  selected
                    ? "border-accent-500/60 bg-accent-500/15 text-accent-400"
                    : "border-line/10 text-ink-200 hover:bg-line/10"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-400">Paleta de color</p>
        <div role="radiogroup" aria-label="Paleta de color" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {PALETTES.map((item) => {
            const selected = palette === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPalette(item.id)}
                className={clsx(
                  "flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/30",
                  selected ? "border-accent-500/60 bg-accent-500/10" : "border-line/10 hover:bg-line/5"
                )}
              >
                <Swatches colors={item.swatches} />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-semibold text-ink-50">{item.label}</p>
                    <p className="text-[12px] text-ink-300">{item.description}</p>
                  </div>
                  {selected && <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[12px] text-ink-400">Se guarda en este dispositivo.</p>
    </div>
  );
};
