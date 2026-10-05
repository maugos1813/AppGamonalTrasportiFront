import logo from "../../assets/logo.png";
import heroImage from "../../assets/login-hero.webp";

const FEATURES = [
  {
    title: "Seguimiento GPS en tiempo real",
    text: "Ubicacion de cada vehiculo y chofer en un mismo mapa.",
    icon: (
      <path d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    ),
  },
  {
    title: "Servicios y rutas planificadas",
    text: "Kilometros, paradas y horarios siempre bajo control.",
    icon: <path d="M4 6h10a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h12M4 6a1.5 1.5 0 1 0 0-.01M20 18a1.5 1.5 0 1 0 0-.01" />,
  },
  {
    title: "Alertas al instante",
    text: "Area C, exceso de velocidad y novedades en tu celular.",
    icon: <path d="M15 17H9m9-1V11a6 6 0 1 0-12 0v5l-1.5 2h15L18 16Zm-4.5 4a1.5 1.5 0 0 1-3 0" />,
  },
];

const FeatureIcon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const AuthLayout = ({ children, title, subtitle }) => (
  <div className="min-h-dvh w-full lg:grid lg:grid-cols-[1.1fr_1fr]">
    {/* Panel de marca: solo en pantallas grandes */}
    <aside className="relative hidden overflow-hidden bg-[#06101f] text-white lg:block">
      <img
        src={heroImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#06101f] via-[#06101f]/68 to-[#0a2a63]/35" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06101f]/70 via-[#06101f]/25 to-transparent" />

      <div className="relative z-10 flex h-full min-h-dvh flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-11 w-11 rounded-xl shadow-lg" />
          <span className="text-lg font-semibold tracking-tight">Gamonal Driver</span>
        </div>

        <div className="max-w-xl">
          <h2 className="text-[40px] font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            Control total de tu flota,
            <span className="block text-emerald-400">en un solo lugar.</span>
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-white/75">
            Servicios, rutas y choferes conectados en tiempo real para que cada entrega salga bien.
          </p>

          <ul className="mt-9 space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300 ring-1 ring-white/15 backdrop-blur">
                  <FeatureIcon>{feature.icon}</FeatureIcon>
                </span>
                <div>
                  <p className="text-[15px] font-semibold">{feature.title}</p>
                  <p className="text-[14px] text-white/65">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[13px] text-white/50">
          &copy; {new Date().getFullYear()} Gamonal Driver. Todos los derechos reservados.
        </p>
      </div>
    </aside>

    {/* Formulario */}
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-background">
        <div className="hidden dark:block absolute -top-1/3 left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-accent-500/30 blur-[140px]" />
        <div className="hidden dark:block absolute bottom-[-20%] left-[-10%] h-[50vh] w-[50vh] rounded-full bg-fuchsia-500/15 blur-[140px]" />
        <div className="hidden dark:block absolute bottom-[-15%] right-[-10%] h-[55vh] w-[55vh] rounded-full bg-cyan-400/15 blur-[140px]" />
      </div>

      {/* Banda con la imagen: solo en celular, el panel grande no entra */}
      <div className="relative z-10 h-44 shrink-0 lg:hidden">
        <div className="absolute inset-0 overflow-hidden">
          <img src={heroImage} alt="" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#06101f]/30 to-[#06101f]/70" />
        </div>
        <img
          src={logo}
          alt="Gamonal Driver"
          className="absolute bottom-0 left-1/2 h-20 w-20 -translate-x-1/2 translate-y-1/2 rounded-2xl shadow-lg ring-4 ring-white dark:ring-[#0b1220]"
        />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-6 pt-14 sm:px-6 lg:py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-[28px] font-semibold tracking-tight text-ink-50 sm:text-[32px]">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-[15px] text-ink-300">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>

      <p className="relative z-10 pb-6 text-center text-[12px] text-ink-500 lg:hidden">
        &copy; {new Date().getFullYear()} Gamonal Driver
      </p>
    </main>
  </div>
);
