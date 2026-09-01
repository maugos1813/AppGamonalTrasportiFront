import { ADMIN_AREA_RECORDS_SECTION } from "./constants";

// null = sin restriccion (OWNER, o ADMIN de un area sin seccion propia todavia, ej.
// FARMACIA). Array (no un solo valor) porque un area puede quedar acotada a mas de
// una seccion.
export const scopedRecordsSections = (user) =>
  user?.cargo === "ADMIN" ? (ADMIN_AREA_RECORDS_SECTION[user.area] ?? null) : null;
