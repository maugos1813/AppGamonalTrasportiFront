import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_PALETTE, PALETTE_IDS } from "../lib/themes";

const ThemeContext = createContext(null);

const STORAGE_KEY = "gt-theme";
const PALETTE_STORAGE_KEY = "gt-palette";

const readStored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// La app arrancaba siempre oscura (bg-black fijo); se mantiene "dark" como
// default para que no cambie el aspecto para quien ya la usa.
const getInitialTheme = () => {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) {
    return "light";
  }
  return "dark";
};

const getInitialPalette = () => {
  const stored = readStored(PALETTE_STORAGE_KEY);
  return PALETTE_IDS.includes(stored) ? stored : DEFAULT_PALETTE;
};

// Se aplica al <html> de forma sincrona (antes de re-renderizar) para que los
// graficos, que leen colores literales de las variables CSS al renderizar,
// vean ya la paleta nueva y no la anterior.
const applyMode = (mode) => {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage puede fallar en navegacion privada; no es critico.
  }
};

const applyPalette = (palette) => {
  const root = document.documentElement;
  if (palette === DEFAULT_PALETTE) root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", palette);
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    // idem
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [palette, setPaletteState] = useState(getInitialPalette);

  const setTheme = useCallback((mode) => {
    if (mode !== "dark" && mode !== "light") return;
    applyMode(mode);
    setThemeState(mode);
  }, []);

  const setPalette = useCallback((id) => {
    if (!PALETTE_IDS.includes(id)) return;
    applyPalette(id);
    setPaletteState(id);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyMode(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, palette, setPalette }),
    [theme, setTheme, toggleTheme, palette, setPalette]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  return ctx;
};
