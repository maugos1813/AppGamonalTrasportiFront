// Recharts necesita colores literales (no puede leer variables CSS via clases
// Tailwind), asi que estos valores espejan --ink-400/--line de index.css para
// cada tema.
export const useChartAxisColors = (theme) =>
  theme === "dark"
    ? { tickColor: "#8e8e93", axisLineColor: "rgba(255,255,255,0.12)", cursorColor: "rgba(255,255,255,0.06)" }
    : { tickColor: "#7d8494", axisLineColor: "rgba(10,22,40,0.12)", cursorColor: "rgba(10,22,40,0.05)" };

// Espejo de --chart-1..5 de index.css, mas un tono neutro para "Otros" en
// graficos categoricos (torta/dona).
const CHART_PALETTE = {
  dark: ["#6f7bf7", "#2fb675", "#e8a23d", "#b34fe0", "#e8543f"],
  light: ["#e4643a", "#3c9c93", "#2b4a6b", "#e4b93f", "#e8a23d"],
};
const OTROS_COLOR = { dark: "#8e8e93", light: "#7d8494" };

export const useChartPalette = (theme) => {
  const palette = CHART_PALETTE[theme] ?? CHART_PALETTE.dark;
  return (index, isOtros) => (isOtros ? OTROS_COLOR[theme] ?? OTROS_COLOR.dark : palette[index % palette.length]);
};
