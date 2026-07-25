import { ADMIN_AREA_DASHBOARD_SECTION, ADMIN_AREA_RECORDS_SECTION } from "./constants";

// null = sin restriccion (OWNER, o ADMIN de un area sin seccion propia todavia, ej. FARMACIA).
export const scopedRecordsSection = (user) =>
  user?.cargo === "ADMIN" ? (ADMIN_AREA_RECORDS_SECTION[user.area] ?? null) : null;

export const scopedDashboardSection = (user) =>
  user?.cargo === "ADMIN" ? (ADMIN_AREA_DASHBOARD_SECTION[user.area] ?? null) : null;
