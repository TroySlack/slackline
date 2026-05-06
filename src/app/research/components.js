"use client";
import { ResponsiveContainer, LineChart, Line, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

const BURGUNDY = "#8B1A1A";
const GOLD = "#C9A84C";
const SUB = "#5C5750";
const BORDER = "rgba(139,26,26,0.5)";
const SERIF = "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif";
const SANS = "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const chartTitle = {
  fontFamily: SANS, fontSize: 10, fontWeight: 700, color: SUB,
  textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14,
};
const axisProps = { tick: { fontSize: 11, fill: SUB, fontFamily: SERIF }, axisLine: { stroke: "rgba(0,0,0,0.15)" }, tickLine: false };

function CurrentDot(props) {
  const { cx, cy, payload } = props;
  if (!payload?.current) return <circle cx={cx} cy={cy} r={3} fill={BURGUNDY} stroke="none" />;
  return <circle cx={cx} cy={cy} r={5.5} fill={GOLD} stroke={BURGUNDY} strokeWidth={1.5} />;
}

export function TrendChart({ title, data = [], median, dashed = false, yFormat }) {
  const formatter = yFormat || ((v) => v);
  return (
    <div>
      {title && <div style={chartTitle}>{title}</div>}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={formatter} domain={["auto","auto"]} />
          <Tooltip
            contentStyle={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2, fontSize: 12, fontFamily: SERIF, padding: "6px 10px" }}
            labelStyle={{ color: SUB, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontFamily: SANS, fontWeight: 700 }}
            formatter={(v) => [formatter(v), ""]}
          />
          {median != null && <ReferenceLine y={median} stroke={GOLD} strokeDasharray="4 3" strokeWidth={1.25} />}
          <Line
            type="linear"
            dataKey="value"
            stroke={BURGUNDY}
            strokeWidth={1.5}
            strokeDasharray={dashed ? "5 4" : undefined}
            dot={<CurrentDot />}
            activeDot={{ r: 5, fill: BURGUNDY, stroke: "#fff", strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart({ title, data = [], yFormat }) {
  const formatter = yFormat || ((v) => v);
  return (
    <div>
      {title && <div style={chartTitle}>{title}</div>}
      <ResponsiveContainer width="100%" height={220}>
        <RBarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={formatter} />
          <Tooltip
            cursor={{ fill: "rgba(139,26,26,0.05)" }}
            contentStyle={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2, fontSize: 12, fontFamily: SERIF, padding: "6px 10px" }}
            labelStyle={{ color: SUB, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontFamily: SANS, fontWeight: 700 }}
            formatter={(v) => [formatter(v), ""]}
          />
          <Bar dataKey="value" fill={BURGUNDY} isAnimationActive={false} />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartPair({ children }) {
  return (
    <div className="research-chart-pair" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "20px 0" }}>
      {children}
    </div>
  );
}
