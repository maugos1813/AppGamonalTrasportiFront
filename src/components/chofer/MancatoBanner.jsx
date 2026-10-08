import { Link } from "react-router-dom";
import { TollArt } from "./illustrations";

const MegaphoneIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M3 11v3a1 1 0 0 0 1 1h2l8 4V6L6 10H4a1 1 0 0 0-1 1Z" />
    <path d="M18 9a4 4 0 0 1 0 6M7 15l1.2 4.2a1 1 0 0 0 1 .8h1.3a1 1 0 0 0 1-1.2L11 17" />
  </svg>
);

export const MancatoBanner = () => (
  <section className="glass-surface relative overflow-hidden rounded-3xl p-5 sm:p-6">
    <div className="relative z-10 flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-400">
        <MegaphoneIcon className="h-6 w-6" />
      </span>
      <div className="min-w-0 pr-20 sm:pr-32">
        <h2 className="text-[17px] font-semibold text-ink-50">¿Pasaste un peaje sin pagar?</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-300">
          Sube el aviso de mancato pagamento apenas lo recibas: asi se asigna a tu servicio y no se te pasa el plazo.
        </p>
        <Link
          to="/finanzas/mancato/new"
          className="mt-3 inline-block text-[14px] font-semibold text-accent-400 hover:text-accent-300"
        >
          Subir mancato pagamento &rarr;
        </Link>
      </div>
    </div>
    <TollArt className="pointer-events-none absolute -bottom-1 right-3 h-16 w-24 text-accent-400 opacity-70 sm:right-6 sm:h-24 sm:w-32" />
  </section>
);
