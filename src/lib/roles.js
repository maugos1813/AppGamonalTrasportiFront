import { RECORD_AREAS } from "./recordAreas";

// Sub-rol de un Responsable: su equipo. Lo que ve lo decide la lista de areas que marca el Admin.
export const RESPONSABLE_TIPOS = [
  { value: "MILANO_SUD", label: "Milano Sud" },
  { value: "MILANO_NORD", label: "Milano Nord" },
];

// Nivel de un chofer: fija su meta mensual de km.
export const NIVELES_CHOFER = [
  { value: "NOVATO", label: "Novato" },
  { value: "MASTER", label: "Master" },
  { value: "SENIOR", label: "Senior" },
];

// Areas que trae marcadas cada sub-rol al ascender a alguien a Responsable (mismo valor que el servidor).
export const RESPONSABLE_PRESETS = {
  MILANO_SUD: ["dhl-milano", "ab-service", "otros"],
  MILANO_NORD: [],
};

export const AREA_ACCESS_OPTIONS = RECORD_AREAS.map((area) => ({ key: area.key, label: area.label }));
export const AREA_LABEL_BY_KEY = Object.fromEntries(AREA_ACCESS_OPTIONS.map((a) => [a.key, a.label]));

export const responsableTipoLabel = (value) => RESPONSABLE_TIPOS.find((t) => t.value === value)?.label ?? null;
export const nivelLabel = (value) => NIVELES_CHOFER.find((n) => n.value === value)?.label ?? null;

// Areas de servicio que ve el usuario: null = todas (Admin), array = solo esas (Responsable).
export const userAreaKeys = (user) => (user?.cargo === "ADMIN" ? (user.areasPermitidas ?? []) : null);

// "Admin", "Responsable · Milano Sud", "Chofer · Master".
export const roleText = (user) => {
  if (!user) return "";
  if (user.cargo === "OWNER") return "Admin";
  if (user.cargo === "ADMIN") {
    const tipo = responsableTipoLabel(user.responsableTipo);
    return tipo ? `Responsable · ${tipo}` : "Responsable";
  }
  const nivel = nivelLabel(user.nivelChofer);
  return nivel ? `Chofer · ${nivel}` : "Chofer";
};
