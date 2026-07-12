export const ChartTooltip = ({ active, payload, formatValue = (v) => v }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0];

  return (
    <div className="glass-surface-sm rounded-lg px-3 py-2 text-[13px]">
      <div className="font-semibold text-ink-50">{formatValue(point.value)}</div>
      <div className="text-ink-400">{point.payload.label}</div>
    </div>
  );
};
