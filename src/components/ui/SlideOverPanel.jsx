import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

// Envoltorio de las pantallas de crear/editar (registros, choferes, vehiculos):
// en desktop (lg+) se ve como un panel que entra deslizando desde la derecha y
// ocupa la mitad de la pantalla, con backdrop para cerrar (click afuera o Esc).
// En celular no aplica nada de esto: el contenido queda igual que siempre, a
// pantalla completa.
export const SlideOverPanel = ({ children, closeTo }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") navigate(closeTo);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, closeTo]);

  return (
    <div className="lg:fixed lg:inset-0 lg:z-30 lg:flex lg:justify-end">
      <Link
        to={closeTo}
        aria-label="Cerrar"
        className="hidden lg:block lg:absolute lg:inset-0 lg:bg-backdrop lg:backdrop-blur-sm"
      />
      <div className="lg:relative lg:z-10 lg:h-dvh lg:w-1/2 lg:animate-slide-in-right lg:overflow-y-auto lg:border-l lg:border-line/10 lg:bg-background lg:shadow-2xl">
        <div className="lg:min-h-full lg:px-8 lg:py-10">{children}</div>
      </div>
    </div>
  );
};
