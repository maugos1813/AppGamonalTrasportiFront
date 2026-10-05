import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { useChartAxisColors } from "./useChartAxisColors";

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-surface-sm rounded-lg px-3 py-2 text-[13px]">
      <div className="font-semibold text-ink-50">{payload[0].value} servicios</div>
      <div className="text-ink-400">{label}</div>
    </div>
  );
};

// Servicios por mes del anio en curso; el mes actual se resalta.
export const ServicesMonthBarChart = ({ data }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={axisLineColor} />
        <XAxis
          dataKey="month"
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
        />
        <YAxis
          width={30}
          allowDecimals={false}
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: cursorColor }} />
        <Bar dataKey="servicios" radius={[5, 5, 0, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={entry.month} fill={entry.isCurrent ? "#3b82f6" : "#3b5b9d"} fillOpacity={entry.isCurrent ? 1 : 0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ServicesMonthBarChart;
