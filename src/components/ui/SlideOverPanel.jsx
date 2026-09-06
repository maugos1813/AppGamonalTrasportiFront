import clsx from "clsx";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Envoltorio de las pantallas de crear/editar (registros, choferes, vehiculos):
// en desktop (lg+) se ve como un panel que entra deslizando desde la derecha y
// ocupa la mitad de la pantalla, con backdrop para cerrar (click afuera o Esc). En
// celular es un overlay a pantalla completa (fixed inset-0, sin las clases lg: de
// abajo) - antes no tenia NINGUNA clase de posicion en celular, asi que quedaba como
// un <div> mas en el flujo normal de la pagina, renderizado DESPUES del contenido de
// atras (ver backgroundLocation en App.jsx) y por lo tanto aparecia mas abajo,
// invisible hasta hacer scroll.
export const SlideOverPanel = ({ children, closeTo }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // OWNER/ADMIN tienen la topbar fija (h-16 + borde) por encima del panel: mismo
  // pt-24 que usa el <main> de AppShell para que no tape el titulo/boton de arriba.
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") navigate(closeTo);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, closeTo]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <Link
        to={closeTo}
        aria-label="Cerrar"
        className="hidden lg:block lg:absolute lg:inset-0 lg:bg-backdrop lg:backdrop-blur-sm"
      />
      <div className="relative z-10 h-dvh w-full overflow-y-auto bg-background lg:w-1/2 lg:animate-slide-in-right lg:border-l lg:border-line/10 lg:shadow-2xl">
        <div
          className={clsx(
            "min-h-full px-4 pb-28 pt-6 lg:px-8 lg:pb-10",
            isPrivileged ? "lg:pt-24" : "lg:pt-10"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
