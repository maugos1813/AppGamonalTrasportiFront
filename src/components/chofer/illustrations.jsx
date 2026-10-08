// Ilustraciones decorativas del dashboard del chofer (SVG simples, sin imagenes externas).
// Usan los colores del tema (currentColor / variables) para verse bien en claro y oscuro.

// Camion de perfil mirando a la derecha. Se usa de fondo en la tarjeta de servicios.
export const TruckArt = ({ className }) => (
  <svg viewBox="0 0 320 150" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="truck-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.15" />
      </linearGradient>
    </defs>
    {/* Furgon */}
    <rect x="6" y="18" width="190" height="86" rx="6" fill="url(#truck-body)" stroke="currentColor" strokeOpacity="0.45" />
    <path d="M30 18v86M70 18v86M110 18v86M150 18v86" stroke="currentColor" strokeOpacity="0.18" />
    {/* Cabina */}
    <path
      d="M204 40h46c6 0 10 2.5 13 7l22 30c2 2.6 3 5.4 3 8.6V104h-84z"
      fill="url(#truck-body)"
      stroke="currentColor"
      strokeOpacity="0.5"
    />
    <path d="M214 48h34c3 0 5 1 6.5 3.2L270 74h-56z" fill="currentColor" fillOpacity="0.28" />
    <rect x="288" y="84" width="14" height="6" rx="3" fill="currentColor" fillOpacity="0.75" />
    {/* Chasis y ruedas */}
    <rect x="6" y="104" width="296" height="10" rx="4" fill="currentColor" fillOpacity="0.3" />
    {[46, 84, 232, 270].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy="116" r="16" fill="var(--background)" stroke="currentColor" strokeOpacity="0.6" strokeWidth="3" />
        <circle cx={cx} cy="116" r="6" fill="currentColor" fillOpacity="0.5" />
      </g>
    ))}
    {/* Ruta */}
    <path d="M0 140h320" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="14 10" />
  </svg>
);

// Cabina de peaje con barrera (aviso de mancato pagamento).
export const TollArt = ({ className }) => (
  <svg viewBox="0 0 120 90" fill="none" className={className} aria-hidden="true">
    <rect x="14" y="14" width="34" height="68" rx="5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeOpacity="0.5" />
    <rect x="20" y="22" width="22" height="16" rx="3" fill="currentColor" fillOpacity="0.45" />
    <rect x="20" y="44" width="22" height="6" rx="3" fill="var(--warning-500)" fillOpacity="0.9" />
    <rect x="20" y="54" width="22" height="4" rx="2" fill="currentColor" fillOpacity="0.4" />
    {/* Barrera */}
    <g transform="rotate(-24 50 44)">
      <rect x="48" y="38" width="66" height="10" rx="3" fill="#fff" fillOpacity="0.9" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={54 + i * 12} y="38" width="6" height="10" fill="var(--warning-500)" />
      ))}
    </g>
    <rect x="8" y="82" width="104" height="3" rx="1.5" fill="currentColor" fillOpacity="0.3" />
  </svg>
);

// Calendario con tilde y reloj (estado vacio de "Mis solicitudes").
export const CalendarCheckArt = ({ className }) => (
  <svg viewBox="0 0 120 90" fill="none" className={className} aria-hidden="true">
    <ellipse cx="60" cy="80" rx="44" ry="6" fill="currentColor" fillOpacity="0.12" />
    <rect x="22" y="18" width="62" height="52" rx="8" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" />
    <path d="M22 32h62" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" />
    <path d="M38 12v12M68 12v12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => (
        <rect key={`${r}${c}`} x={30 + c * 13} y={39 + r * 9} width="8" height="5" rx="1.5" fill="currentColor" fillOpacity="0.45" />
      ))
    )}
    <circle cx="86" cy="62" r="15" fill="var(--glass-surface-bg)" stroke="currentColor" strokeWidth="2.5" />
    <path d="M86 53v9l6 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="26" cy="68" r="9" fill="var(--success-500)" />
    <path d="m22 68 3 3 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
