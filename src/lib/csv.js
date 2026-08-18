import { RECORD_STATUS_LABELS, ZONA_LABELS } from "./constants";
import { formatDate } from "./format";

// Separador ";" y decimales con coma (no ".") - un CSV con "," como separador de
// columna Y de decimales es ambiguo, y Excel en espanol/italiano (la configuracion
// real de esta operacion) espera ";" entre columnas. Mismo criterio que formatCurrency
// (locale es-AR) ya usa en el resto de la app, solo que sin el simbolo de moneda: en
// una celda numerica de Excel el simbolo € rompe que se pueda sumar/graficar directo.
const CSV_DELIMITER = ";";

const escapeCsvField = (value) => {
  const str = String(value ?? "");
  return /[";\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const formatCsvNumber = (value) =>
  value == null ? "" : value.toLocaleString("es-AR", { maximumFractionDigits: 2 });

const SECTION_LABELS = {
  DHL: "DHL",
  AB_SERVICE: "AB Service",
  EXTRAS_STEFANIA: "Extras Stefania",
};
const sectionLabel = (spedizzione) => SECTION_LABELS[spedizzione] ?? "Extras Piazza";

// fechaServicio no lleva hora real para los registros sincronizados desde AppSheet
// (siempre queda en medianoche) - ETA es el campo que si tiene la hora real (mismo
// criterio que usa el filtro de horario del backend, ver matchesTimeRange).
const formatHora = (value) =>
  value ? new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

const CSV_COLUMNS = [
  ["Fecha", (r) => formatDate(r.fechaServicio)],
  ["Hora (ETA)", (r) => formatHora(r.eta)],
  ["Codigo", (r) => r.codigo],
  ["Seccion", (r) => sectionLabel(r.spedizzione)],
  ["Zona", (r) => (r.extrasPiazzaZona ? ZONA_LABELS[r.extrasPiazzaZona] : "Sin zona")],
  ["Estado", (r) => RECORD_STATUS_LABELS[r.estado] ?? r.estado],
  ["Chofer", (r) => (r.driver ? `${r.driver.nombre} ${r.driver.apellido}` : "")],
  ["Vehiculo", (r) => r.vehicle?.targa ?? ""],
  ["Cliente", (r) => r.client?.nombre ?? ""],
  ["Destino", (r) => r.destinazione ?? ""],
  ["Km planificado", (r) => formatCsvNumber(r.kilometros)],
  ["Km real", (r) => formatCsvNumber(r.kilometrosReales)],
  ["Precio/km", (r) => formatCsvNumber(r.precioKm)],
  ["Total sin combustible", (r) => formatCsvNumber(r.total)],
  ["Combustible", (r) => formatCsvNumber(r.costoCombustible)],
  ["Monto recibido", (r) => formatCsvNumber(r.pagoRecibido)],
  ["Comentarios", (r) => r.comentarios ?? ""],
];

export const buildRecordsCsv = (records) => {
  const header = CSV_COLUMNS.map(([label]) => escapeCsvField(label)).join(CSV_DELIMITER);
  const rows = records.map((r) =>
    CSV_COLUMNS.map(([, getValue]) => escapeCsvField(getValue(r))).join(CSV_DELIMITER)
  );
  // BOM al inicio: sin esto, Excel abre el archivo asumiendo Latin-1 y los acentos/ñ
  // de Cliente/Destino/Comentarios se ven mal (mojibake) en vez de UTF-8 real.
  return `﻿${[header, ...rows].join("\r\n")}`;
};

export const downloadCsv = (filename, csvContent) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
