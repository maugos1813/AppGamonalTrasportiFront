import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { formatCurrency } from "../../lib/format";
import { ChartTooltip } from "./ChartTooltip";
import { useChartPalette } from "./useChartAxisColors";

// Dona de facturacion por cliente (top clientes + "Otros"), con leyenda de
// puntos de color al costado, igual al patron "Distribucion por cliente" del
// style pack. En mobile la dona y la leyenda se apilan (ver ownerDashboardPage).
export const ClientDistributionChart = ({ data }) => {
  const { theme } = useTheme();
  const getColor = useChartPalette(theme);

  if (data.length === 0) {
    return <p className="py-8 text-center text-[13px] text-ink-400">Sin facturacion en este periodo.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={getColor(index, entry.name === "Otros")} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatValue={formatCurrency} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex w-full max-w-xs flex-col gap-2 sm:w-auto">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-ink-200">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: getColor(index, entry.name === "Otros") }}
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="shrink-0 font-medium text-ink-50">{Math.round(entry.percent)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
