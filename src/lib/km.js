// Km de un servicio. Mismo criterio que utils/kmFacturables.js del backend:
//  - DHL, DHL Roma y AB Service: el cliente manda los km SOLO de ida, se cuentan x2 y se facturan a la tarifa de DHL.
//  - Extras Piazza / Extras Stefania: los km planificados se cuentan x1; el costo es km x precio por km.
export const kmMultiplier = (record) => (record?.spedizzione === "DHL" || record?.spedizzione === "AB_SERVICE" ? 2 : 1);

// Km planificados contados para facturar y comparar (DHL / AB Service: los del cliente x2).
export const kmFacturables = (record) =>
  record?.kmFacturables ?? Math.round((record?.kilometros ?? 0) * kmMultiplier(record) * 10) / 10;

// Km que se supone que recorrio el vehiculo: los reales si el chofer los cargo, si no los facturables.
export const kmRecorrido = (record) => record?.kilometrosReales || kmFacturables(record) || 0;
