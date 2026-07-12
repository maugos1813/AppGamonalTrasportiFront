export const AuthLayout = ({ children, title, subtitle }) => (
  <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
    <div className="pointer-events-none absolute inset-0 bg-black">
      <div className="absolute -top-1/3 left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-accent-500/30 blur-[140px]" />
      <div className="absolute bottom-[-20%] left-[-10%] h-[50vh] w-[50vh] rounded-full bg-fuchsia-500/15 blur-[140px]" />
      <div className="absolute bottom-[-15%] right-[-10%] h-[55vh] w-[55vh] rounded-full bg-cyan-400/15 blur-[140px]" />
    </div>

    <div className="relative z-10 w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl glass-surface-sm">
          <span className="text-xl font-semibold tracking-tight text-ink-50">GT</span>
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-50 sm:text-[32px]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[15px] text-ink-300">{subtitle}</p>}
      </div>

      {children}
    </div>
  </div>
);
