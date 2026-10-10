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
