// GPS del celular del chofer (ubicacion en vivo, permiso de "todo el tiempo", switch del
// perfil, avisos de GPS apagado). Apagado: la ubicacion de la flota sale del GPS del
// vehiculo (Velocity Fleet). Para volver a usarlo, VITE_PHONE_GPS=true al compilar (y
// PHONE_LOCATION_ENABLED=true en el backend).
export const PHONE_GPS_ENABLED = import.meta.env.VITE_PHONE_GPS === "true";
