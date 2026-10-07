import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { formatCurrency } from "../../lib/format";
import { useBrandColor, useChartAxisColors } from "../charts/useChartAxisColors";

const compact = (value) => (Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`);

const DebtTooltip = ({ active, payload, label, valueLabel }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-surface-sm rounded-lg px-3 py-2 text-[13px]">
      <div className="mb-0.5 font-semibold text-ink-50">{label}</div>
      <div className="text-ink-300">
        {valueLabel}: <span className="font-medium text-ink-50">{formatCurrency(payload[0].value)}</span>
      </div>
    </div>
  );
};

// Deuda abierta (sin pagar) al cierre de cada mes. data: [{ label, value }].
export const MancatoDebtChart = ({ data, valueLabel = "Por pagar" }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor } = useChartAxisColors(theme);
  const COLOR = useBrandColor(theme);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="mancatoDebtFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLOR} stopOpacity={0.35} />
            <stop offset="95%" stopColor={COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <Tooltip content={<DebtTooltip valueLabel={valueLabel} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={COLOR}
          strokeWidth={2}
          fill="url(#mancatoDebtFill)"
          dot={{ r: 3, fill: COLOR, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
