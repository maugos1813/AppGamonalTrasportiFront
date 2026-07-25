import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { ChartTooltip } from "./ChartTooltip";
import { useChartAxisColors } from "./useChartAxisColors";

const LINE_COLOR = "#f59e0b";

// Punto custom: el dia de hoy se dibuja mas grande con un halo detras y el valor
// como etiqueta arriba (efecto "punto resaltado" de la referencia que paso el
// usuario); los demas dias son puntos chicos sin etiqueta.
const TrendDot = ({ cx, cy, payload, value, index, labelColor }) => {
  if (!payload.isToday) {
    return <circle key={index} cx={cx} cy={cy} r={3} fill={LINE_COLOR} stroke="none" />;
  }
  return (
    <g key={index}>
      <circle cx={cx} cy={cy} r={11} fill={LINE_COLOR} fillOpacity={0.18} />
      <circle cx={cx} cy={cy} r={5} fill={LINE_COLOR} stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize={13} fontWeight={600} fill={labelColor}>
        {value}
      </text>
    </g>
  );
};

// Servicios por dia, ultimos 7 dias - inspirado en la tarjeta "Revenue" de la
// referencia (linea con el punto de hoy resaltado y su valor arriba).
export const ServicesTrendChart = ({ data }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);
  const labelColor = theme === "dark" ? "#f5f5f7" : "#1a2030";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={axisLineColor} />
        <XAxis
          dataKey="label"
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
        />
        <Tooltip
          content={<ChartTooltip formatValue={(v) => `${v} ${v === 1 ? "servicio" : "servicios"}`} />}
          cursor={{ stroke: cursorColor }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke={LINE_COLOR}
          strokeWidth={2.5}
          dot={(props) => <TrendDot {...props} labelColor={labelColor} />}
          activeDot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
