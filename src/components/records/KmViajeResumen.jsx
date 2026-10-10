import { formatKmValue } from "../../lib/compactado";

// Km de un viaje compacto en una linea: planificado, real y la diferencia, mas quien repartio los km y por que.
// `km` = compactado.km; `servicios` = compactado.servicios (para nombrar los servicios con km de mas).
export const KmViajeResumen = ({ km, servicios = [], className }) => {
  if (!km) return null;
  const { planificado, circuito, real, extra, grande, reparto } = km;
  const nombres = (reparto?.servicioIds ?? [])
    .map((id) => servicios.find((s) => s.id === id)?.codigo)
    .filter(Boolean)
    .join(", ");

  return (
    <div className={className}>
      <p className="text-[13px] text-ink-100">
        {circuito ? "Circuito planificado" : "Planificado"} <b>{formatKmValue(planificado)}</b> · Real <b>{formatKmValue(real)}</b>
        {extra != null && extra !== 0 && (
          <span className={extra > 0 ? "font-semibold text-warning-500" : "font-semibold text-accent-400"}>
            {" "}
            ({extra > 0 ? "+" : ""}
            {formatKmValue(extra)})
          </span>
        )}
      </p>
      {circuito && (
        <p className="mt-0.5 text-[12px] text-ink-400">
          Lugar de espera &rarr; retiro &rarr; todas las paradas en orden &rarr; lugar de espera.
        </p>
      )}
      {real != null && reparto?.origen === "CHOFER" && (
        <p className="mt-0.5 text-[12px] text-ink-300">
          El chofer indicó los km de más{nombres ? ` en ${nombres}` : ""}.
          {reparto.nota ? ` «${reparto.nota}»` : ""}
        </p>
      )}
      {real != null && reparto?.origen === "ADMIN" && (
        <p className="mt-0.5 text-[12px] text-ink-300">
          Reparto ajustado por la oficina{nombres ? `: los km de más van en ${nombres}` : ""}.
          {reparto.nota ? ` «${reparto.nota}»` : ""}
        </p>
      )}
      {real != null && reparto?.origen === "AUTO" && (
        <p className={grande ? "mt-0.5 text-[12px] text-warning-500" : "mt-0.5 text-[12px] text-ink-300"}>
          {grande
            ? "Km de más sin detalle del chofer: se repartieron proporcional a lo planificado. Ajusta el reparto si hace falta."
            : "Repartido automáticamente entre los servicios, proporcional a lo planificado."}
          {reparto.nota && reparto.nota.startsWith("Reparto automatico de un viaje") ? "" : reparto.nota ? ` «${reparto.nota}»` : ""}
        </p>
      )}
    </div>
  );
};
