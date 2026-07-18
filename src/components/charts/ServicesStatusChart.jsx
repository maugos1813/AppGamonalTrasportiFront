import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { RECORD_STATUS_CHART_COLOR, RECORD_STATUS_OPTIONS } from "../../lib/constants";
import { ChartTooltip } from "./ChartTooltip";
import { useChartAxisColors } from "./useChartAxisColors";

export const ServicesStatusChart = ({ byEstado }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);

  const data = RECORD_STATUS_OPTIONS.map((opt) => ({
    key: opt.value,
    label: opt.label,
    value: byEstado[opt.value] ?? 0,
    color: RECORD_STATUS_CHART_COLOR[opt.value],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 24, bottom: 0 }} barCategoryGap="20%">
        <XAxis
          dataKey="label"
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={50}
        />
        <Tooltip
          cursor={{ fill: cursorColor }}
          content={<ChartTooltip />}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
