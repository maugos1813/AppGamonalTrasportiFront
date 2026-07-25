import clsx from "clsx";
import { Spinner } from "./Spinner";

// Loader de pantalla/seccion completa, reusable en toda la app. Mismo Spinner (CSS
// puro, sin libs) que ya se usaba suelto y repetido en cada pagina - solo se le suma
// un mensaje, para no agregar peso al bundle.
export const PageLoader = ({
  message = "Configurando para tu mejor experiencia...",
  className = "flex flex-col items-center justify-center gap-3 py-16",
}) => (
  <div className={clsx(className)}>
    <Spinner className="h-6 w-6 border-line/20 border-t-line" />
    <p className="text-sm text-ink-400">{message}</p>
  </div>
);
