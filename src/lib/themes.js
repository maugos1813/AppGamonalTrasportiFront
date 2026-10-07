// Paletas de color disponibles. Las variables CSS de cada una viven en
// src/index.css (bloques html[data-palette="..."]); aca solo va lo que necesita
// la interfaz para listarlas: nombre y muestras de color (las de la referencia).
export const DEFAULT_PALETTE = "clasico";

export const PALETTES = [
  {
    id: "clasico",
    label: "Clásico",
    description: "Azul marino con el verde de Gamonal Driver.",
    swatches: ["#0a1628", "#12305f", "#2f8dff", "#22e093", "#6ff2b8"],
  },
  {
    id: "oceano",
    label: "Océano",
    description: "Azules y turquesas frescos.",
    swatches: ["#7bd5f5", "#787ff6", "#4adede", "#1ca7ec", "#1f2f98"],
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Pasteles suaves: menta, limón y lila.",
    swatches: ["#86e3ce", "#d0e6a5", "#ffdd94", "#fa897b", "#ccabd8"],
  },
  {
    id: "crepusculo",
    label: "Crepúsculo",
    description: "Índigo profundo con coral y durazno.",
    swatches: ["#0b0742", "#120c6e", "#5e72eb", "#ff9190", "#fdc094"],
  },
];

export const PALETTE_IDS = PALETTES.map((p) => p.id);
