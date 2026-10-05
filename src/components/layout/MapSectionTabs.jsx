import clsx from "clsx";
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/mapa", label: "Mapa", end: true },
  { to: "/mapa/area-c", label: "Área C", end: false },
];

// Selector de las dos vistas de la seccion Mapa: el mapa en vivo y el listado de Area C.
export const MapSectionTabs = ({ className }) => (
  <nav aria-label="Vistas del mapa" className={clsx("inline-flex items-center gap-1 rounded-full glass-surface-sm p-1", className)}>
    {TABS.map((tab) => (
      <NavLink
        key={tab.to}
        to={tab.to}
        end={tab.end}
        className={({ isActive }) =>
          clsx(
            "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
            isActive ? "bg-line/15 text-ink-50" : "text-ink-300 hover:text-ink-50"
          )
        }
      >
        {tab.label}
      </NavLink>
    ))}
  </nav>
);
