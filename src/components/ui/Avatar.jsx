import clsx from "clsx";

// Muestra la foto de perfil si existe, o un circulo con las iniciales como fallback.
export const Avatar = ({ user, className }) =>
  user?.imagenUrl ? (
    <img
      src={user.imagenUrl}
      alt={`${user.nombre ?? ""} ${user.apellido ?? ""}`}
      className={clsx("shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-500/20 font-semibold text-accent-300",
        className
      )}
    >
      {user?.nombre?.[0]}
      {user?.apellido?.[0]}
    </div>
  );
