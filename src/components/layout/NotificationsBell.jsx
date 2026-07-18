import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useChoferAlerts } from "../../hooks/useChoferAlerts";
import { Spinner } from "../ui/Spinner";

const BellIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

// variant="sidebar": el boton vive dentro del sidebar/bottom-nav, que es navy
// fijo (no cambia con el tema), asi que no puede usar los tokens ink-*/line
// (pensados para el fondo de la app) o se volveria invisible en tema claro.
export const NotificationsBell = ({ variant = "default" }) => {
  const { alerts, loading } = useChoferAlerts();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const isSidebar = variant === "sidebar";

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        title="Notificaciones"
        className={clsx(
          "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-4",
          isSidebar
            ? clsx(
                "hover:bg-sidebar-accent focus-visible:ring-sidebar-active/30",
                open ? "text-sidebar-foreground" : "text-sidebar-foreground/75"
              )
            : clsx(
                "glass-surface-sm hover:bg-line/10 hover:text-ink-50 focus-visible:ring-line/20",
                open ? "text-ink-50" : "text-ink-300"
              )
        )}
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {alerts.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-20 w-72 rounded-2xl glass-surface p-3 sm:w-80">
          <span className="block px-1 pb-2 text-[13px] font-medium text-ink-300">
            Notificaciones
          </span>

          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-5 w-5 border-line/20 border-t-line" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-ink-400">Sin alertas pendientes.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="rounded-xl border border-status-rischedulato/25 bg-status-rischedulato/10 px-3 py-2.5 text-[13px] text-status-rischedulato"
                >
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
