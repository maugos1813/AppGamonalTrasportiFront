import { Alert } from "../ui/Alert";
import { avisosFechas } from "../../lib/fechasServicio";

// Avisos al instante bajo los campos de fecha: la oficina decide las fechas, esto solo marca lo que no cuadra.
export const FechasAviso = ({ fechas, original }) => {
  const avisos = avisosFechas(fechas, original);
  if (!avisos.length) return null;
  return (
    <Alert variant="warning">
      <ul className="space-y-0.5">
        {avisos.map((aviso) => (
          <li key={aviso}>{aviso}</li>
        ))}
      </ul>
      <p className="mt-1 text-[12px] opacity-80">Puedes guardar igual: las fechas quedan exactamente como las escribiste.</p>
    </Alert>
  );
};
