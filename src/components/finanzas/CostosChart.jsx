import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { COSTO_COLORS } from "../../lib/finanzas";
import { formatCurrency } from "../../lib/format";
import { useChartAxisColors } from "../charts/useChartAxisColors";

const compact = (value) => (Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`);

const SERIES = [
  { key: "pagoChoferes", label: "Pago a choferes" },
  { key: "gastosServicios", label: "Gastos de servicios" },
  { key: "combustible", label: "Combustible" },
];

const CostosTooltip = ({ active, payload, label, series }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <div className="glass-surface-sm rounded-lg px-3 py-2 text-[13px]">
      <div className="mb-1 font-semibold text-ink-50">{label}</div>
      {series
        .map((s) => payload.find((p) => p.dataKey === s.key))
        .filter(Boolean)
        .map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-ink-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
              {p.name}
            </span>
            <span className="font-medium text-ink-50">{formatCurrency(p.value)}</span>
          </div>
        ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-line/15 pt-1 text-ink-300">
        <span>Total</span>
        <span className="font-semibold text-ink-50">{formatCurrency(total)}</span>
      </div>
    </div>
  );
};

// Costo de cada mes apilado por tipo. data: [{ label, pagoChoferes, gastosServicios, combustible }].
// Si alguna serie no aplica (el chofer no ve los gastos de servicios) se omite.
export const CostosChart = ({ data }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor } = useChartAxisColors(theme);
  const series = SERIES.filter((s) => data.some((row) => row[s.key] > 0));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={axisLineColor} />
        <XAxis
          dataKey="label"
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
        />
        <YAxis
          width={38}
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={compact}
          allowDecimals={false}
        />
        <Tooltip content={<CostosTooltip series={series} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: tickColor, paddingTop: 6 }}
        />
        {series.map((s, index) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="costos"
            fill={COSTO_COLORS[s.key]}
            radius={index === series.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};
