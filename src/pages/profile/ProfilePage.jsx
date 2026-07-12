import { GlassCard } from "../../components/ui/GlassCard";
import { StatCard } from "../../components/ui/StatCard";
import { useAuth } from "../../context/AuthContext";
import { AREA_OPTIONS, CARGO_LABELS } from "../../lib/constants";
import { formatDate } from "../../lib/format";

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

export const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Mi perfil</h1>
        <p className="mt-1 text-[14px] text-ink-300">Tu informacion dentro de Gamonal Trasporti.</p>
      </div>

      <GlassCard>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-xl font-semibold text-accent-300">
            {user?.nombre?.[0]}
            {user?.apellido?.[0]}
          </div>
          <div>
            <h2 className="text-[22px] font-semibold text-ink-50">
              {user?.nombre} {user?.apellido}
            </h2>
            <p className="text-[14px] text-ink-300">{user?.correoElectronico}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Cargo" value={CARGO_LABELS[user?.cargo] ?? user?.cargo} tone="blue" />
          <StatCard label="Area" value={areaLabel(user?.area)} />
          <StatCard
            label="Estado de la cuenta"
            value={user?.estado === "ACTIVO" ? "Activo" : "Inactivo"}
            tone={user?.estado === "ACTIVO" ? "green" : "red"}
          />
          <StatCard label="Numero de celular" value={user?.numeroCelular} />
          <StatCard label="Fecha de nacimiento" value={formatDate(user?.fechaNacimiento)} />
          <StatCard label="Miembro desde" value={formatDate(user?.createdAt)} />
        </div>
      </GlassCard>
    </div>
  );
};
