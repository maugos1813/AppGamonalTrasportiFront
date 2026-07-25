import clsx from "clsx";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NotificationsProvider } from "../../context/NotificationsContext";
import { useTheme } from "../../context/ThemeContext";
import { useLocationSharing } from "../../hooks/useLocationSharing";
import { MobileNavDrawer } from "./MobileNavDrawer";
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

const ChecklistIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 10.5l1.8 1.8L13.5 8.5" />
    <path d="M8 16h8" />
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

const SunIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

// Botón que alterna claro/oscuro; el icono mostrado es el modo al que se
// cambiaria al hacer click (convencion habitual: sol = "pasar a claro"). Con
// "label" se ve como una fila mas del menu (sidebar); sin el, como boton redondo.
const ThemeToggleButton = ({ className, iconClassName, label }) => {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  const text = theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";

  return (
    <button type="button" onClick={toggleTheme} aria-label={text} title={text} className={className}>
      <Icon className={iconClassName ?? "h-[18px] w-[18px]"} />
      {label && text}
    </button>
  );
};

const WrenchIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L3 17.5V21h3.5l6.3-6.3a4 4 0 0 0 4.9-5.4l-2.8 2.8-2.1-2.1 2.8-2.8z" />
  </svg>
);

const MapPinIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.3" />
  </svg>
);

// Nav vertical fija a la izquierda para pantallas de desktop (sm y mas anchas).
// En celular se usa la BottomNavTab de mas abajo en su lugar.
const SidebarNavTab = ({ to, label, icon: Icon }) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      clsx(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
        isActive
          ? "bg-sidebar-active font-semibold text-sidebar-active-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )
    }
  >
    <Icon className="h-5 w-5 shrink-0" />
    {label}
  </NavLink>
);

// Nav inferior fija para pantallas de celular: ocupa todo el ancho, siempre visible
// arriba del contenido de cada seccion. En desktop se usa la SidebarNavTab de la izquierda.
const BottomNavTab = ({ to, label, icon: Icon }) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      clsx(
        "flex flex-1 flex-col items-center justify-center gap-1 py-3.5 text-[11px] font-medium transition-colors",
        isActive ? "text-sidebar-active" : "text-sidebar-foreground/60"
      )
    }
  >
    <Icon className="h-6 w-6" />
    {label}
  </NavLink>
);

// Secciones que en mobile viven en el nav deslizable (MobileNavDrawer) en vez del
// nav inferior, para no saturarlo de iconos - se activa tocando el logo GT del
// header. En desktop siguen en el sidebar fijo de siempre, sin cambios.
const DRAWER_NAV_ITEMS = [
  { to: "/mapa", label: "Mapa", icon: MapPinIcon },
  { to: "/mecanica", label: "Mecanica", icon: WrenchIcon },
];

export const AppShell = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useLocationSharing();

  return (
    <NotificationsProvider>
    <div className="relative min-h-dvh w-full bg-background">
      <div className="pointer-events-none fixed inset-0">
        <div className="hidden dark:block absolute -top-1/3 left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-accent-500/20 blur-[140px]" />
        <div className="hidden dark:block absolute bottom-[-20%] right-[-10%] h-[55vh] w-[55vh] rounded-full bg-cyan-400/10 blur-[140px]" />
      </div>

      {/* Topbar fija de desktop para OWNER/ADMIN: ocupa todo el ancho a la derecha del
          sidebar, siempre arriba de todo (z-40, por encima incluso de los paneles
          deslizantes de formularios en z-30) para que nada la tape nunca. Ademas de la
          campanita, es donde va cualquier otro boton global que se agregue a futuro. */}
      {isPrivileged && (
        <header className="fixed left-0 right-0 top-0 z-40 hidden h-16 items-center justify-end gap-2 border-b border-line/10 bg-background px-6 sm:left-60 sm:flex">
          <NotificationsBell />
        </header>
      )}

      <div className="relative z-10 sm:flex">
        {/* Sidebar fija a la izquierda en desktop; en celular se reemplaza por el
            header + nav inferior de abajo. Navy fijo (no cambia con el tema),
            igual que el sidebar del style pack. */}
        <aside className="hidden sm:sticky sm:top-0 sm:flex sm:h-dvh sm:w-60 sm:shrink-0 sm:flex-col sm:justify-between sm:border-r sm:border-sidebar-border sm:bg-sidebar sm:px-4 sm:py-6">
          <div>
            <Link to="/" className="flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-yellow">
                <span className="text-sm font-bold text-brand-navy">GT</span>
              </div>
              <span className="text-[15px] font-semibold text-sidebar-foreground">Gamonal Trasporti</span>
            </Link>

            <nav className="mt-8 flex flex-col gap-1">
              <SidebarNavTab to="/" label="Inicio" icon={HomeIcon} />
              <SidebarNavTab to="/resumen" label="Resumen" icon={ChecklistIcon} />
              <SidebarNavTab to="/records" label="Registros" icon={ListIcon} />
              {isPrivileged && <SidebarNavTab to="/choferes" label="Choferes" icon={UsersIcon} />}
              {isPrivileged && <SidebarNavTab to="/vehiculos" label="Vehiculos" icon={TruckIcon} />}
              {isPrivileged && <SidebarNavTab to="/mapa" label="Mapa" icon={MapPinIcon} />}
              {isPrivileged && <SidebarNavTab to="/mecanica" label="Mecanica" icon={WrenchIcon} />}
            </nav>
          </div>

          <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-active font-semibold text-sidebar-active-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )
              }
            >
              <UserIcon className="h-5 w-5 shrink-0" />
              Mi perfil
            </NavLink>

            {user?.cargo === "CHOFER" && (
              <div className="px-3 py-1">
                <NotificationsBell variant="sidebar" />
              </div>
            )}

            <ThemeToggleButton
              label
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              iconClassName="h-5 w-5 shrink-0"
            />

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogoutIcon className="h-5 w-5 shrink-0" />
              Cerrar sesion
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between gap-4 px-4 py-6 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menu"
              title="Abrir menu"
              className="flex items-center gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-yellow">
                <span className="text-sm font-bold text-brand-navy">GT</span>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <NavLink
                to="/profile"
                aria-label="Ver mi perfil"
                title="Ver mi perfil"
                className={({ isActive }) =>
                  clsx(
                    "flex h-10 w-10 items-center justify-center rounded-full glass-surface-sm transition-colors hover:bg-line/10 hover:text-ink-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-line/20",
                    isActive ? "text-ink-50" : "text-ink-300"
                  )
                }
              >
                <UserIcon className="h-[18px] w-[18px]" />
              </NavLink>

              {(user?.cargo === "CHOFER" || isPrivileged) && <NotificationsBell />}
            </div>
          </header>

          {/* sm:pt-24 en vez de sm:pt-10 cuando es OWNER/ADMIN: deja espacio para que la
              topbar fija (h-16 + borde) nunca tape el contenido de la pagina. */}
          <main
            className={clsx(
              "px-4 pb-28 sm:px-6 sm:pb-10",
              isPrivileged ? "sm:pt-24" : "sm:pt-10"
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex w-full items-stretch border-t border-sidebar-border bg-sidebar/95 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)] sm:hidden">
        <BottomNavTab to="/" label="Inicio" icon={HomeIcon} />
        <BottomNavTab to="/resumen" label="Resumen" icon={ChecklistIcon} />
        <BottomNavTab to="/records" label="Registros" icon={ListIcon} />
        {isPrivileged && <BottomNavTab to="/choferes" label="Choferes" icon={UsersIcon} />}
        {isPrivileged && <BottomNavTab to="/vehiculos" label="Vehiculos" icon={TruckIcon} />}
      </nav>

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        items={isPrivileged ? DRAWER_NAV_ITEMS : []}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={logout}
      />
    </div>
    </NotificationsProvider>
  );
};
