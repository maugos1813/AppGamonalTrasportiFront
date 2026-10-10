// Orden de las paradas de un viaje compacto por hora de llegada (ETA); empate: el que se creo primero.
export const sortByEta = (items) =>
  [...items].sort((a, b) => new Date(a.eta) - new Date(b.eta) || String(a.codigo).localeCompare(String(b.codigo)));

// Mueve un elemento una posicion (-1 sube, +1 baja) sin mutar la lista.
export const moveItem = (list, index, delta) => {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export const MAX_SERVICIOS_VIAJE = 8;

// ---------------------------------------------------------------- km del viaje
// Los km reales de un viaje compacto se anotan una sola vez (todo el viaje) y se reparten entre sus servicios.
// Con km de mas por encima de cualquiera de estos topes se le pregunta al chofer en que servicio fueron. Son los
// mismos que KM_EXTRA_UMBRAL_* del backend (config/viajes.js): si se cambian, cambiarlos en los dos.
export const KM_EXTRA_UMBRAL_KM = 10;
export const KM_EXTRA_UMBRAL_PCT = 0.15;

const round1 = (value) => Math.round(value * 10) / 10;

export const extraEsGrande = (extra, planificado) =>
  extra > KM_EXTRA_UMBRAL_KM || (planificado > 0 && extra > planificado * KM_EXTRA_UMBRAL_PCT);

// Igual que repartirKm del backend (utils/kmReparto.js): `servicios` = [{ id, plan }]. Devuelve los km de cada uno
// (a 1 decimal, sumando exactamente el total), el planificado y el extra.
export const repartirKm = ({ total, servicios, extraIds = [] }) => {
  const totalKm = round1(total);
  const planificado = round1(servicios.reduce((sum, s) => sum + s.plan, 0));
  const extra = round1(totalKm - planificado);
  const elegidos = extraIds.filter((id) => servicios.some((s) => s.id === id));

  let raw;
  if (extra > 0 && elegidos.length > 0) {
    raw = servicios.map((s) => s.plan + (elegidos.includes(s.id) ? extra / elegidos.length : 0));
  } else if (planificado > 0) {
    raw = servicios.map((s) => (totalKm * s.plan) / planificado);
  } else {
    raw = servicios.map(() => totalKm / servicios.length);
  }
  const km = raw.map(round1);
  const diff = round1(totalKm - km.reduce((sum, v) => sum + v, 0));
  if (diff !== 0) {
    const biggest = km.indexOf(Math.max(...km));
    km[biggest] = round1(km[biggest] + diff);
  }
  return { total: totalKm, planificado, extra, km: servicios.map((s, i) => ({ id: s.id, km: km[i] })) };
};

export const formatKmValue = (value) => (value == null ? "-" : `${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`);
