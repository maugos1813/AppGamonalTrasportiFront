import { toRomeDateTimeInputValue } from "./format";

// Revisa las fechas que escribe la oficina (todas en hora de Roma, "AAAA-MM-DDTHH:mm", asi que se
// comparan como texto) y devuelve avisos. No cambia nada ni bloquea: solo avisa en el momento.
// `original` = valores ya guardados (al editar): una ETA vieja de un servicio ya hecho no es un error,
// solo se avisa de lo que se acaba de tocar.
export const avisosFechas = ({ fechaServicio, fechaRetiro, eta }, original = {}) => {
  const avisos = [];
  if (!eta) return avisos;

  const day = (value) => value.slice(0, 10);
  const ahora = toRomeDateTimeInputValue(new Date());

  if (eta !== original.eta && eta < ahora) {
    avisos.push("La ETA es una fecha y hora que ya pasaron.");
  }
  if (fechaRetiro && eta <= fechaRetiro) {
    avisos.push("La ETA es anterior (o igual) a la fecha de retiro.");
  }
  if (fechaServicio && day(eta) < day(fechaServicio)) {
    avisos.push("La ETA cae en un día anterior a la fecha de servicio.");
  }
  return avisos;
};
