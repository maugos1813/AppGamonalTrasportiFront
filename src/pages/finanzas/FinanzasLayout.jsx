import clsx from "clsx";
import { NavLink, Outlet } from "react-router-dom";
import { WalletIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";

const tabClass = ({ isActive }) =>
  clsx(
    "whitespace-nowrap border-b-2 px-3.5 py-3 text-[14px] font-medium transition-colors",
    isActive
      ? "border-accent-400 text-ink-50"
      : "border-transparent text-ink-300 hover:text-ink-50"
  );

// Contenedor de "Finanzas Operativas": titulo, pestañas y, debajo, la pestaña activa.
// Las rutas viven bajo /finanzas (ver App.jsx); los detalles y altas de cada modulo se
// abren encima de la pestaña como panel lateral.
export const FinanzasLayout = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
          <WalletIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-ink-50">Finanzas Operativas</h1>
          <p className="mt-0.5 text-[14px] text-ink-300">
            {isPrivileged
              ? "Lo que se debe, lo que se gasta y lo que se paga a los choferes, en un solo lugar."
              : "Tus pagos, multas, mancato pagamento y cargas de combustible."}
          </p>
        </div>
      </div>

      <nav
        aria-label="Secciones de finanzas"
        className="-mx-4 flex overflow-x-auto border-b border-line/15 px-4 sm:mx-0 sm:px-0"
      >
        <NavLink to="/finanzas" end className={tabClass}>
          Resumen
        </NavLink>
        <NavLink to="/finanzas/pagos" className={tabClass}>
          {isPrivileged ? "Pago a choferes" : "Mi pago"}
        </NavLink>
        {isPrivileged && (
          <NavLink to="/finanzas/gastos" className={tabClass}>
            Gastos de servicios
          </NavLink>
        )}
        <NavLink to="/finanzas/combustible" className={tabClass}>
          Combustible
        </NavLink>
        <NavLink to="/finanzas/mancato" className={tabClass}>
          Mancato Pagamento
        </NavLink>
        <NavLink to="/finanzas/multas" className={tabClass}>
          Multas
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
};
