import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { formatCurrency } from "../../lib/format";
import { ChartTooltip } from "./ChartTooltip";
import { useChartPalette } from "./useChartAxisColors";

// Dona de facturacion por cliente (top clientes + "Otros"). Sin leyenda aparte:
// al pasar el mouse por una porcion, el tooltip ya muestra el nombre del cliente
// y el monto (ver ChartTooltip), asi que la lista de colores al costado sobraba.
export const ClientDistributionChart = ({ data }) => {
  const { theme } = useTheme();
  const getColor = useChartPalette(theme);

  if (data.length === 0) {
    return <p className="py-8 text-center text-[13px] text-ink-400">Sin facturacion en este periodo.</p>;
  }

  return (
    <div className="flex h-full items-center justify-center">
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
    </div>
  );
};
