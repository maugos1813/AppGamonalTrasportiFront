import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { CHART_COLORS } from "../../lib/constants";
import { formatCurrency } from "../../lib/format";
import { ChartTooltip } from "./ChartTooltip";
import { useChartAxisColors } from "./useChartAxisColors";

// Facturacion (area con degrade) + ganancia (linea fina encima), mes a mes del anio
// en curso - inspirado en el grafico "Performance Overview" de la referencia.
export const RevenueTrendChart = ({ data }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.facturacion} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS.facturacion} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={axisLineColor} />
        <XAxis
          dataKey="month"
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip formatValue={formatCurrency} />} cursor={{ stroke: cursorColor }} />
        <Area
          type="monotone"
          dataKey="facturacion"
          name="Facturacion"
          stroke={CHART_COLORS.facturacion}
          strokeWidth={2}
          fill="url(#revenueTrendFill)"
        />
        <Line
          type="monotone"
          dataKey="ganancia"
          name="Ganancia"
          stroke={CHART_COLORS.gananciaPositiva}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
