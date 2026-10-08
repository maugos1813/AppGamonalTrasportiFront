import { useCallback, useEffect, useState } from "react";
import { MultaChoferCard } from "../../components/chofer/MultaChoferCard";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { listMultasRequest } from "../../lib/multas.api";

const PAGE_SIZE = 50;
const MAX_PAGES = 4;

const Section = ({ title, hint, multas, onChanged }) =>
  multas.length === 0 ? null : (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[16px] font-semibold text-ink-50">
          {title} <span className="text-ink-400">({multas.length})</span>
        </h2>
        <p className="text-[12px] text-ink-400">{hint}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {multas.map((m) => (
          <MultaChoferCard key={m.id} multa={m} onChanged={onChanged} />
        ))}
      </div>
    </section>
  );

// "Multas" del chofer: las que paga el (con plazo y comprobante) y las que paga la empresa y se le
// descuentan. Lo demas (notas internas, quien la cargo, totales de la flota) no se muestra.
export const MultasChoferPage = () => {
  const { version, refresh } = useDataRefresh("multas");
  const [multas, setMultas] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      let all = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const data = await listMultasRequest({ page, pageSize: PAGE_SIZE, orden: "recientes" });
        all = all.concat(data.items);
        if (all.length >= data.total) break;
      }
      setMultas(all);
      setError("");
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  if (error) return <Alert>{error}</Alert>;
  if (!multas) return <PageLoader />;

  const pagoPropio = multas.filter((m) => m.quienPaga === "CHOFER_PAGO");
  const aDescontar = multas.filter((m) => m.quienPaga === "A_DESCONTAR");
  const porPagar = pagoPropio.filter((m) => !m.pagado).reduce((sum, m) => sum + m.costo, 0);
  const porDescontar = aDescontar.filter((m) => !m.descontado).reduce((sum, m) => sum + m.costo, 0);

  return (
    <div className="flex flex-col gap-5">
      <section className="glass-surface rounded-3xl p-4 sm:p-6">
        <h2 className="text-[19px] font-semibold text-ink-50">Mis multas</h2>
        <p className="mt-1 text-[13px] text-ink-300">
          Las que pagas tu llevan plazo: sube el comprobante apenas pagues y la oficina las marca como pagadas. Las
          otras las paga la empresa y se te descuentan.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-indigo-400/30 bg-line/[0.03] p-3">
            <span className="block text-[12px] text-ink-300">Por pagar (tu)</span>
            <span className="block text-[20px] font-semibold text-ink-50">{formatCurrency(porPagar)}</span>
          </div>
          <div className="rounded-2xl border border-warning-500/30 bg-line/[0.03] p-3">
            <span className="block text-[12px] text-ink-300">Se te va a descontar</span>
            <span className="block text-[20px] font-semibold text-ink-50">{formatCurrency(porDescontar)}</span>
          </div>
        </div>
      </section>

      {multas.length === 0 && (
        <div className="glass-surface-sm rounded-2xl px-4 py-8 text-center text-[14px] text-ink-300">
          No tienes multas registradas.
        </div>
      )}

      <Section
        title="Las pagas tu"
        hint="Tienen plazo de pago. Sube el comprobante cuando pagues."
        multas={pagoPropio}
        onChanged={refresh}
      />
      <Section
        title="Te las descontamos"
        hint="Las paga la empresa y se descuentan despues. No tienes que hacer nada."
        multas={aDescontar}
        onChanged={refresh}
      />
    </div>
  );
};
