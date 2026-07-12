import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { RECORD_STATUS_CHART_COLOR, RECORD_STATUS_OPTIONS } from "../../lib/constants";
import { ChartTooltip } from "./ChartTooltip";

export const ServicesStatusChart = ({ byEstado }) => {
  const data = RECORD_STATUS_OPTIONS.map((opt) => ({
    key: opt.value,
    label: opt.label,
    value: byEstado[opt.value] ?? 0,
    color: RECORD_STATUS_CHART_COLOR[opt.value],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 24, bottom: 0 }} barCategoryGap="20%">
        <XAxis
          dataKey="label"
          tick={{ fill: "#8e8e93", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          tickLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={50}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.06)" }}
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
