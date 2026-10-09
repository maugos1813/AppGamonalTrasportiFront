export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const periodoLabel = (anio, mes) => `${MESES[mes - 1]} ${anio}`;

// Abre un PDF cuya URL se pide al servidor: se abre la pestaña en el momento del toque (si no, el
// navegador del celular bloquea el popup) y despues se le asigna la direccion.
export const openPdfFromRequest = async (request) => {
  const win = window.open("", "_blank");
  try {
    const { url } = await request();
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (err) {
    win?.close();
    throw err;
  }
};
