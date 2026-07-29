import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { CHART_COLORS } from "../../lib/constants";
import { formatKm } from "../../lib/format";
import { ChartTooltip } from "./ChartTooltip";
import { useChartAxisColors } from "./useChartAxisColors";

// Kilometros mes a mes del anio en curso - mismo formato que RevenueTrendChart (area
// con degrade), pero con su propio color para distinguirlo de un vistazo del de
// facturacion/ganancia.
export const KmTrendChart = ({ data }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="kmTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.km} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS.km} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={axisLineColor} />
        <XAxis
          dataKey="month"
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip formatValue={formatKm} />} cursor={{ stroke: cursorColor }} />
        <Area
          type="monotone"
          dataKey="km"
          name="Kilometros"
          stroke={CHART_COLORS.km}
          strokeWidth={2}
          fill="url(#kmTrendFill)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
export default KmTrendChart;
