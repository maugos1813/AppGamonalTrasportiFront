import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { ChartTooltip } from "./ChartTooltip";
import { useChartAxisColors } from "./useChartAxisColors";

const TODAY_COLOR = "#f59e0b";
const OTHER_COLOR_DARK = "#3a3a3f";
const OTHER_COLOR_LIGHT = "#d4d8e0";

// Mini grafico de barras por dia (ultimos 7 dias) - inspirado en la tarjeta "Total
// sales" de la referencia que paso el usuario: solo la barra de hoy resaltada, el
// resto en gris.
export const ServicesWeekBarChart = ({ data }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);
  const otherColor = theme === "dark" ? OTHER_COLOR_DARK : OTHER_COLOR_LIGHT;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="30%">
        <XAxis
          dataKey="label"
          tick={{ fill: tickColor, fontSize: 10 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: cursorColor }}
          content={<ChartTooltip formatValue={(v) => `${v} ${v === 1 ? "servicio" : "servicios"}`} />}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={18}>
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.isToday ? TODAY_COLOR : otherColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
