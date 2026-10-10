import { toRomeDateTimeInputValue } from "./format";

// Revisa las fechas que escribe la oficina (todas en hora de Roma, "AAAA-MM-DDTHH:mm", asi que se
// comparan como texto) y devuelve avisos. No cambia nada ni bloquea: solo avisa en el momento.
// `original` = valores ya guardados (al editar): una ETA vieja de un servicio ya hecho no es un error,
// solo se avisa de lo que se acaba de tocar.
export const avisosFechas = ({ fechaRetiro, eta, retiroPaqueteAt }, original = {}) => {
  const avisos = [];
  if (retiroPaqueteAt && fechaRetiro && retiroPaqueteAt >= fechaRetiro) {
    avisos.push("El retiro del paquete tiene que ser antes de la salida a entregar (Fecha retiro).");
  }
  if (!eta) return avisos;

  const ahora = toRomeDateTimeInputValue(new Date());

  if (eta !== original.eta && eta < ahora) {
    avisos.push("La ETA es una fecha y hora que ya pasaron.");
  }
  if (fechaRetiro && eta <= fechaRetiro) {
    avisos.push("La ETA es anterior (o igual) a la fecha de retiro.");
  }
  return avisos;
};
