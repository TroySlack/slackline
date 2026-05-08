"use client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

const BURGUNDY = "#8B1A1A";
const GREY = "#6E6E6E";
const GREY_LIGHT = "#D9D2C5";
const GOLD = "#C9A84C";
const SUB = "#5C5750";
const SERIF = "'Source Serif 4', 'Source Serif Pro', Georgia, serif";
const SANS = "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const titleStyle = {
  fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1,
  textTransform: "uppercase", color: SUB, marginBottom: 10,
};
const cardStyle = {
  background: "#fff", border: `0.5px solid ${BURGUNDY}`, borderRadius: 2,
  padding: "14px 14px 8px",
};
const tickStyle = { fontSize: 10, fill: GREY, fontFamily: SERIF };

function PercentLineChart({ title, data }) {
  if (!data?.labels?.length) return null;
  const series = data.labels.map((l, i) => ({ label: l, value: data.data[i] }));
  const min = Math.floor(Math.min(...data.data) - 1);
  const max = Math.ceil(Math.max(...data.data) + 1);
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={series} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 3" stroke={GREY_LIGHT} vertical={false} />
          <XAxis dataKey="label" tick={tickStyle} axisLine={{ stroke: GREY_LIGHT }} tickLine={false} />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={[min, max]} tickFormatter={v => v} width={42} />
          <Tooltip formatter={v => v + "%"} contentStyle={{ borderRadius: 2, border: `0.5px solid ${BURGUNDY}`, fontSize: 11, fontFamily: SERIF }} />
          <Line type="linear" dataKey="value" stroke={BURGUNDY} strokeWidth={1.5} dot={{ r: 2, fill: BURGUNDY, strokeWidth: 0 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MultiplesChart({ data }) {
  if (!data?.labels?.length) return null;
  const series = data.labels.map((l, i) => ({
    label: l,
    pe: data.pe?.[i] ?? null,
    evEbitda: data.evEbitda?.[i] ?? null,
  }));
  const all = [...(data.pe || []), ...(data.evEbitda || [])].filter(v => v != null);
  const min = Math.floor(Math.min(...all) - 2);
  const max = Math.ceil(Math.max(...all) + 2);
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Multiple compression: P/E &amp; EV/EBITDA</div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={series} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 3" stroke={GREY_LIGHT} vertical={false} />
          <XAxis dataKey="label" tick={tickStyle} axisLine={{ stroke: GREY_LIGHT }} tickLine={false} />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={[min, max]} tickFormatter={v => v + "x"} width={42} />
          <Tooltip formatter={v => v + "x"} contentStyle={{ borderRadius: 2, border: `0.5px solid ${BURGUNDY}`, fontSize: 11, fontFamily: SERIF }} />
          {data.peMedian != null && (
            <ReferenceLine y={data.peMedian} stroke={GOLD} strokeDasharray="3 3" strokeWidth={1}
              label={{ value: `10y median ${data.peMedian}x`, position: "insideTopRight", fill: GOLD, fontSize: 9, fontFamily: SANS, fontWeight: 700 }} />
          )}
          <Line type="linear" dataKey="pe" stroke={BURGUNDY} strokeWidth={1.5} dot={{ r: 2, fill: BURGUNDY, strokeWidth: 0 }} name="P/E" isAnimationActive={false} connectNulls />
          <Line type="linear" dataKey="evEbitda" stroke={GREY} strokeWidth={1.25} strokeDasharray="4 3" dot={{ r: 2, fill: GREY, strokeWidth: 0 }} name="EV/EBITDA" isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 10, fontFamily: SANS, color: SUB, fontWeight: 600, letterSpacing: 0.5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 1.5, background: BURGUNDY }} /> P/E</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 0, borderTop: `1.5px dashed ${GREY}` }} /> EV/EBITDA</span>
      </div>
    </div>
  );
}

function RevenueChart({ data }) {
  if (!data?.labels?.length) return null;
  const unit = data.unit || "";
  const series = data.labels.map((l, i) => ({ label: l, value: data.data[i] }));
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Annual revenue {unit ? `($${unit})` : ""}</div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={series} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 3" stroke={GREY_LIGHT} vertical={false} />
          <XAxis dataKey="label" tick={tickStyle} axisLine={{ stroke: GREY_LIGHT }} tickLine={false} />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={v => v} width={42} />
          <Tooltip formatter={v => `$${v}${unit}`} contentStyle={{ borderRadius: 2, border: `0.5px solid ${BURGUNDY}`, fontSize: 11, fontFamily: SERIF }} cursor={{ fill: "rgba(139,26,26,0.05)" }} />
          <Bar dataKey="value" fill={BURGUNDY} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ThesisCharts({ charts }) {
  if (!charts) return null;
  const panels = [];
  if (charts.grossMargin) panels.push(<PercentLineChart key="gm" title="Gross margin %" data={charts.grossMargin} />);
  if (charts.roe) panels.push(<PercentLineChart key="roe" title="ROE %" data={charts.roe} />);
  if (charts.multiples) panels.push(<MultiplesChart key="mult" data={charts.multiples} />);
  if (charts.revenue) panels.push(<RevenueChart key="rev" data={charts.revenue} />);
  if (!panels.length) return null;
  // 1–3 panels in a single row; 4+ wraps to 2×2 on a wider screen
  const cols = panels.length >= 4 ? "repeat(2, minmax(0, 1fr))" : `repeat(${panels.length}, minmax(0, 1fr))`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, marginBottom: 24 }}>
      {panels}
    </div>
  );
}
