import clsx from "clsx";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NotificationsBell } from "./NotificationsBell";

const UserIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);

const LogoutIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const HomeIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1h4v-6h3v6h4a1 1 0 0 0 1-1v-9" />
  </svg>
);

const ListIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

const UsersIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20c0-3.4 3-5 6.5-5s6.5 1.6 6.5 5" />
    <circle cx="17.5" cy="9" r="2.5" />
    <path d="M15.8 20c.1-2.6 1.6-4.2 3.7-4.6" />
  </svg>
);

const TruckIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 7h11v9H2z" />
    <path d="M13 10h4l3.5 3.5V16h-7.5" />
    <circle cx="6.5" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);

const NavTab = ({ to, label }) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      clsx(
        "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
        isActive ? "bg-white/15 text-ink-50" : "text-ink-300 hover:text-ink-50"
      )
    }
  >
    {label}
  </NavLink>
);

// Nav inferior fija para pantallas de celular: ocupa todo el ancho, siempre visible
// arriba del contenido de cada seccion. En desktop se sigue usando el NavTab de arriba.
const BottomNavTab = ({ to, label, icon: Icon }) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      clsx(
        "flex flex-1 flex-col items-center justify-center gap-1 py-3.5 text-[11px] font-medium transition-colors",
        isActive ? "text-ink-50" : "text-ink-400"
      )
    }
  >
    <Icon className="h-6 w-6" />
    {label}
  </NavLink>
);

export const AppShell = () => {
  const { user, logout } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  return (
    <div className="relative min-h-dvh w-full bg-black">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-1/3 left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-accent-500/20 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[55vh] w-[55vh] rounded-full bg-cyan-400/10 blur-[140px]" />
      </div>

      <div className="relative z-10">
        <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glass-surface-sm">
              <span className="text-sm font-semibold text-ink-50">GT</span>
            </div>
            <span className="hidden text-[17px] font-medium text-ink-50 sm:inline">
              Gamonal Trasporti
            </span>
          </Link>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <NavLink
                to="/profile"
                aria-label="Ver mi perfil"
                title="Ver mi perfil"
                className={({ isActive }) =>
                  clsx(
                    "flex h-10 w-10 items-center justify-center rounded-full glass-surface-sm transition-colors hover:bg-white/10 hover:text-ink-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20",
                    isActive ? "text-ink-50" : "text-ink-300"
                  )
                }
              >
                <UserIcon className="h-[18px] w-[18px]" />
              </NavLink>

              {user?.cargo === "CHOFER" && <NotificationsBell />}

              <button
                type="button"
                onClick={logout}
                aria-label="Cerrar sesion"
                title="Cerrar sesion"
                className="flex h-10 w-10 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-white/10 hover:text-ink-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
              >
                <LogoutIcon className="h-[18px] w-[18px]" />
              </button>
            </div>

            <nav className="hidden items-center gap-1 rounded-full glass-surface-sm p-1 sm:flex">
              <NavTab to="/" label="Inicio" />
              <NavTab to="/records" label="Registros" />
              {isPrivileged && <NavTab to="/choferes" label="Choferes" />}
              {isPrivileged && <NavTab to="/vehiculos" label="Vehiculos" />}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 sm:px-6 sm:pb-16">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex w-full items-stretch border-t border-white/10 bg-black/70 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)] sm:hidden">
        <BottomNavTab to="/" label="Inicio" icon={HomeIcon} />
        <BottomNavTab to="/records" label="Registros" icon={ListIcon} />
        {isPrivileged && <BottomNavTab to="/choferes" label="Choferes" icon={UsersIcon} />}
        {isPrivileged && <BottomNavTab to="/vehiculos" label="Vehiculos" icon={TruckIcon} />}
      </nav>
    </div>
  );
};
