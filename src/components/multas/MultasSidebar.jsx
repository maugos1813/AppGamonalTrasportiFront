import clsx from "clsx";
import { BulbIcon, FileTextIcon } from "../ui/icons";
import { PanelShell } from "../ui/PanelShell";
import { formatCurrency } from "../../lib/format";
import { DebtSummary, Evolution } from "../mancato/MancatoSidebar";

// Mensaje y accion segun lo mas urgente que haya.
const buildRecommendation = (r, isPrivileged) => {
  if (r.vencidasMasDe30Dias > 0) {
    return {
      text: `Tienes ${r.vencidasMasDe30Dias} ${r.vencidasMasDe30Dias === 1 ? "multa vencida" : "multas vencidas"} hace mas de 30 dias.`,
      detail: "Regularizalas cuanto antes y sube el comprobante para dejar el control al dia.",
      filter: { estado: "VENCIDO" },
    };
  }
  if (r.vencidas > 0) {
    return {
      text: `Tienes ${r.vencidas} ${r.vencidas === 1 ? "multa vencida" : "multas vencidas"} por ${formatCurrency(r.totalVencido)}.`,
      detail: "Pagalas y sube el comprobante para dejarlas al dia.",
      filter: { estado: "VENCIDO" },
    };
  }
  if (r.porVencer7Dias > 0) {
    return {
      text: `${r.porVencer7Dias} ${r.porVencer7Dias === 1 ? "multa vence" : "multas vencen"} en los proximos 7 dias.`,
      detail: "Pagalas a tiempo para que no pasen a vencidas.",
      filter: { estado: "PENDIENTE" },
    };
  }
  if (r.aDescontarPendiente > 0) {
    const multas = `${r.aDescontarPendiente} ${r.aDescontarPendiente === 1 ? "multa" : "multas"}`;
    return isPrivileged
      ? {
          text: `Faltan descontar ${formatCurrency(r.totalADescontar)} a los choferes (${multas}).`,
          detail: "Aplica los descuentos y marcalos como descontados.",
          filter: { descuentoPendiente: true },
        }
      : {
          text: `Se te van a descontar ${formatCurrency(r.totalADescontar)} (${multas}).`,
          detail: "Es el importe de las multas que pago la empresa a tu nombre.",
          filter: { descuentoPendiente: true },
        };
  }
  return { text: "Todo al dia.", detail: "No hay multas vencidas, por vencer ni descuentos pendientes.", filter: null };
};

const Recommendation = ({ data, isPrivileged, onSeeDetails }) => {
  const rec = buildRecommendation(data, isPrivileged);
  const urgent = rec.filter != null;
  return (
    <section
      className={clsx(
        "rounded-2xl border p-5",
        urgent ? "border-warning-500/50 bg-warning-500/[0.06]" : "border-success-500/30 bg-success-500/[0.05]"
      )}
    >
      <div className="flex items-start gap-3">
        <BulbIcon className={clsx("mt-0.5 h-5 w-5 shrink-0", urgent ? "text-warning-500" : "text-success-500")} />
        <div className="min-w-0">
          <h2 className={clsx("text-[15px] font-semibold", urgent ? "text-warning-500" : "text-success-500")}>
            Recomendacion
          </h2>
          <p className="mt-1 text-[14px] font-medium text-ink-50">{rec.text}</p>
          <p className="mt-1 text-[13px] text-ink-300">{rec.detail}</p>
        </div>
      </div>
      {urgent && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onSeeDetails(rec.filter)}
            className="rounded-full glass-input px-4 py-1.5 text-[13px] font-medium text-ink-50 hover:bg-line/10"
          >
            Ver detalles &rarr;
          </button>
        </div>
      )}
    </section>
  );
};

// Lo que falta descontar en el pago de cada chofer: el control principal de "a descontar".
const ADescontar = ({ stats, onSeeDetails }) => (
  <PanelShell
    icon={FileTextIcon}
    title="A descontar"
    aside={
      <span className="text-right text-[11px] text-ink-400">
        Pendiente de descuento
        <span className="block text-[15px] font-semibold text-warning-500">
          {formatCurrency(stats.aDescontar.total)}
        </span>
      </span>
    }
  >
    {stats.porChoferADescontar.length === 0 ? (
      <p className="py-2 text-[13px] text-ink-400">No hay descuentos pendientes.</p>
    ) : (
      <ul className="flex flex-col gap-2.5">
        {stats.porChoferADescontar.map((row) => (
          <li key={row.driverId ?? "none"} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[14px] text-ink-50">
              {row.nombre}
              <span className="ml-2 text-[12px] text-ink-400">
                {row.count} {row.count === 1 ? "multa" : "multas"}
              </span>
            </span>
            <span className="shrink-0 text-[14px] font-semibold text-ink-50">{formatCurrency(row.total)}</span>
          </li>
        ))}
      </ul>
    )}
    {stats.aDescontar.count > 0 && (
      <button
        type="button"
        onClick={() => onSeeDetails({ descuentoPendiente: true })}
        className="mt-3 text-[12px] font-medium text-accent-400 hover:text-accent-300"
      >
        Ver las {stats.aDescontar.count} pendientes &rarr;
      </button>
    )}
  </PanelShell>
);

// Columna derecha de Multas: deuda por chofer, descuentos pendientes, evolucion y recomendacion.
export const MultasSidebar = ({ stats, summary, isPrivileged, onSeeDetails }) => {
  if (!stats) return null;

  // OWNER/ADMIN ven la deuda abierta por chofer; el chofer la ve por estado.
  const rows = isPrivileged
    ? stats.porChofer.map((c) => ({
        key: c.driverId ?? "otros",
        label: c.nombre,
        count: c.count,
        total: c.total,
        isOtros: !c.driverId,
      }))
    : [
        { key: "VENCIDO", label: "Vencidas", color: "#ff3b57", ...summary?.VENCIDO },
        { key: "PENDIENTE", label: "Pendientes", color: "#ff8a1a", ...summary?.PENDIENTE },
      ].filter((r) => r.count > 0);

  return (
    <aside className="flex flex-col gap-5">
      <DebtSummary rows={rows} total={stats.totalPorPagar} unit={["multa", "multas"]} />
      <ADescontar stats={stats} onSeeDetails={onSeeDetails} />
      <Evolution serie={stats.serie} deltaPct={stats.serieDeltaPct} />
      <Recommendation data={stats.recomendacion} isPrivileged={isPrivileged} onSeeDetails={onSeeDetails} />
    </aside>
  );
};
