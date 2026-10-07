// Recharts necesita colores literales (no puede leer variables CSS via clases
// Tailwind), asi que se leen de las variables del tema/paleta activos (ver
// index.css). El argumento "theme" ya no se usa para elegir valores, pero los
// componentes lo siguen pasando: sirve para que re-rendericen cuando cambia el
// tema o la paleta (ThemeContext aplica las variables antes de re-renderizar).
const cssVar = (name, fallback) => {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const hexToRgba = (hex, alpha) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

export const useChartAxisColors = (theme) => {
  const line = cssVar("--line", "#ffffff");
  const isLightLine = line.toLowerCase() === "#ffffff";
  return {
    tickColor: cssVar("--ink-400", "#8ea3c9"),
    axisLineColor: hexToRgba(line, isLightLine ? 0.16 : 0.12),
    cursorColor: hexToRgba(line, isLightLine ? 0.06 : 0.05),
  };
};

// Gris tenue para las barras que no son la destacada (ej. dias que no son hoy).
export const useChartNeutral = (theme) => hexToRgba(cssVar("--ink-400", "#8ea3c9"), 0.4);

// --chart-1..5 de index.css, mas el neutro para "Otros".
export const useChartPalette = (theme) => {
  const palette = [1, 2, 3, 4, 5].map((i) => cssVar(`--chart-${i}`, "#2f8dff"));
  const otros = cssVar("--ink-400", "#8ea3c9");
  return (index, isOtros) => (isOtros ? otros : palette[index % palette.length]);
};

// Color de marca de la paleta activa (series que en el diseño original eran verde).
export const useBrandColor = (theme) => cssVar("--brand", "#22e093");

// Etiquetas de valor sobre el grafico: el color de texto principal del tema.
export const useChartLabelColor = (theme) => cssVar("--ink-50", "#f5f5f7");
