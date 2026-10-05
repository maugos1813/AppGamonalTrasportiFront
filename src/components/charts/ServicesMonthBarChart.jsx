import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { AREAS_BY_KEY } from "../../lib/recordAreas";
import { useChartAxisColors } from "./useChartAxisColors";

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value > 0);
  const total = rows.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="glass-surface-sm rounded-lg px-3 py-2 text-[13px]">
      <div className="mb-1 font-semibold text-ink-50">
        {label} · {total} servicios
      </div>
      {rows.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-ink-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {AREAS_BY_KEY[p.dataKey]?.label ?? p.name}: <span className="font-medium text-ink-50">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// Servicios por mes del anio en curso, apilados por area (cada area con su color); el mes
// actual se ve mas fuerte que el resto. areaKeys = las areas que entran en la vista.
export const ServicesMonthBarChart = ({ data, areaKeys }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);

  const flat = data.map((m) => ({ month: m.month, isCurrent: m.isCurrent, ...m.byArea }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={flat} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
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
        {areaKeys.map((key) => (
          <Bar key={key} dataKey={key} stackId="servicios" isAnimationActive={false}>
            {flat.map((entry) => (
              <Cell key={entry.month} fill={AREAS_BY_KEY[key].chartColor} fillOpacity={entry.isCurrent ? 1 : 0.78} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ServicesMonthBarChart;
