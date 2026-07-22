import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { CHART_COLORS } from "../../lib/constants";
import { formatCurrency } from "../../lib/format";
import { ChartTooltip } from "./ChartTooltip";
import { useChartAxisColors } from "./useChartAxisColors";

export const EconomicsChart = ({ facturacion, costos, ganancia }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);

  const data = [
    { key: "facturacion", label: "Facturacion", value: facturacion, color: CHART_COLORS.facturacion },
    { key: "costos", label: "Costos operativos", value: costos, color: CHART_COLORS.costos },
    {
      key: "ganancia",
      label: "Ganancia estimada",
      value: ganancia,
      color: ganancia >= 0 ? CHART_COLORS.gananciaPositiva : CHART_COLORS.gananciaNegativa,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="25%">
        <XAxis
          dataKey="label"
          tick={{ fill: tickColor, fontSize: 12 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: cursorColor }}
          content={<ChartTooltip formatValue={formatCurrency} />}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
