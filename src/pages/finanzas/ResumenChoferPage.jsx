import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarrasMeses, CargoKpi, CargoPanel, EtiquetasMeses } from "../../components/chofer/CargosUi";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import {
  AlertTriangleIcon,
  BarsIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  FuelIcon,
  GavelIcon,
  ReceiptIcon,
  WalletIcon,
} from "../../components/ui/icons";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { currentMonth, monthName } from "../../lib/finanzas";
import { getFinanzasResumenRequest } from "../../lib/finanzas.api";
import { listMancatosRequest } from "../../lib/mancato.api";
import { formatCurrency } from "../../lib/format";

const TONE_EDGE = {
  danger: "border-l-danger-500",
  warning: "border-l-warning-500",
  info: "border-l-accent-400",
};

// Colores de las tarjetas (los del diseño de "Mis cargos").
const COLORS = { teal: "#22d3a6", indigo: "#6366f1", amber: "#f5a524", purple: "#a78bfa", blue: "#2f8dff" };

const compactEur = (v) => `EUR ${Math.round(v).toLocaleString("es-AR")}`;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "Mis cargos" > Resumen (chofer): lo que debe, lo que se le descuenta y su mes. No muestra el costo
// que significa el chofer para la empresa: eso queda en Finanzas de la oficina.
export const ResumenChoferPage = () => {
  const mancatoRefresh = useDataRefresh("mancato").version;
  const multasRefresh = useDataRefresh("multas").version;
  const combustibleRefresh = useDataRefresh("combustible").version;

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [avisos, setAvisos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    Promise.all([
      getFinanzasResumenRequest(month),
      // Avisos de mancato que subio en el mes (solo la cantidad: el pago lo maneja la empresa).
      listMancatosRequest({ from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}`, pageSize: 1 }),
    ])
      .then(([resumen, mancatos]) => {
        if (!cancelled) {
          setData(resumen);
          setAvisos(mancatos.total);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [month, mancatoRefresh, multasRefresh, combustibleRefresh]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <PageLoader />;

  const { pendiente, mes, serie } = data;
  // El mancato lo paga la empresa: el chofer no ve sus plazos ni sus importes.
  const atencion = data.atencion.filter((item) => item.to !== "/finanzas/mancato");
  const rows = serie.map((row) => ({ label: row.label, value: row.pagoChoferes }));

  return (
    <div className="flex flex-col gap-5">
      <CargoPanel
        icon={WalletIcon}
        title="Multas"
        aside={
          <span className="flex items-center gap-1.5 text-[13px] text-ink-300">
            <CalendarIcon className="hidden h-4 w-4 sm:block" />
            Estado de hoy
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <CargoKpi
            to="/finanzas/multas"
            icon={GavelIcon}
            color={COLORS.indigo}
            label="Multas por pagar"
            value={formatCurrency(pendiente.multas.total)}
            detail={
              pendiente.multas.vencidas > 0
                ? `${pendiente.multas.vencidas} vencidas`
                : plural(pendiente.multas.abiertas, "abierta", "abiertas")
            }
          />
          <CargoKpi
            to="/finanzas/multas"
            icon={ClockIcon}
            color={COLORS.amber}
            label="Se te va a descontar"
            value={formatCurrency(pendiente.multas.aDescontar.total)}
            detail={plural(pendiente.multas.aDescontar.count, "multa", "multas")}
          />
        </div>
      </CargoPanel>

      <CargoPanel
        icon={CalendarIcon}
        title={`Tu mes: ${monthName(month)}`}
        subtitle={data.esMesActual ? "Lo que va del mes" : undefined}
        aside={<MonthSelector month={month} onChange={setMonth} />}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <CargoKpi
            to="/mis-horas"
            icon={WalletIcon}
            color={COLORS.teal}
            label="Mi pago del mes"
            value={formatCurrency(mes.pagoChoferes.total)}
            detail={plural(mes.pagoChoferes.servicios, "servicio", "servicios")}
          />
          <CargoKpi
            to="/finanzas/combustible"
            icon={FuelIcon}
            color={COLORS.indigo}
            label="Combustible"
            value={formatCurrency(mes.combustible.total)}
            detail={plural(mes.combustible.cargas, "carga", "cargas")}
          />
          <CargoKpi
            to="/finanzas/mancato"
            className="col-span-2 sm:col-span-1"
            icon={ReceiptIcon}
            color={COLORS.purple}
            label="Mancatos enviados"
            value={avisos ?? 0}
            detail={plural(avisos ?? 0, "aviso", "avisos")}
          />
        </div>
      </CargoPanel>

      <CargoPanel icon={BarsIcon} title="Mi pago de los ultimos 6 meses">
        <BarrasMeses rows={rows} format={formatCurrency} />
        <EtiquetasMeses rows={rows} format={compactEur} />
      </CargoPanel>

      <section className="glass-surface rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line/20 text-ink-100">
            <AlertTriangleIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold text-ink-50">Atencion requerida</h2>
            {atencion.length === 0 && (
              <p className="text-[13px] text-ink-300">Todo al dia, no hay nada vencido ni por vencer.</p>
            )}
          </div>
          {atencion.length === 0 && <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-400" />}
        </div>
        {atencion.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {atencion.map((item) => (
              <li key={item.title}>
                <Link
                  to={item.to}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl border-l-4 bg-line/[0.05] px-4 py-3 transition-colors hover:bg-line/10",
                    TONE_EDGE[item.tone]
                  )}
                >
                  <span className="min-w-0 flex-1 text-[13px] font-medium text-ink-50">{item.title}</span>
                  {item.total != null && (
                    <span className="shrink-0 text-[13px] font-semibold text-ink-50">{formatCurrency(item.total)}</span>
                  )}
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
