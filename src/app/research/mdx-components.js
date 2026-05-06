// Server module: assembles the MDX component map. Imports client chart
// components from ./components and defines the markdown element overrides
// as plain server-renderable functions.
import { TrendChart, BarChart, ChartPair } from "./components";

const BURGUNDY = "#8B1A1A";
const NEAR_BLACK = "#1A1A1A";
const SUB = "#5C5750";
const SERIF = "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif";

function H2(props) {
  return (
    <h2 style={{
      fontFamily: SERIF, fontSize: 20, fontWeight: 500,
      color: NEAR_BLACK, margin: "36px 0 12px",
      paddingBottom: 8, borderBottom: `0.5px solid ${BURGUNDY}`,
      letterSpacing: -0.2,
    }} {...props} />
  );
}

function H3(props) {
  return (
    <h3 style={{
      fontFamily: SERIF, fontSize: 17, fontWeight: 600,
      color: NEAR_BLACK, margin: "28px 0 8px",
    }} {...props} />
  );
}

function P(props) {
  return (
    <p style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.75, color: NEAR_BLACK, margin: "0 0 18px", textAlign: "left" }} {...props} />
  );
}

function UL(props) {
  return <ul style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.75, color: NEAR_BLACK, margin: "0 0 18px", paddingLeft: 22 }} {...props} />;
}

function OL(props) {
  return <ol style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.75, color: NEAR_BLACK, margin: "0 0 18px", paddingLeft: 22 }} {...props} />;
}

function LI(props) { return <li style={{ marginBottom: 6 }} {...props} />; }
function Strong(props) { return <strong style={{ fontWeight: 700, color: NEAR_BLACK }} {...props} />; }
function Em(props) { return <em style={{ fontStyle: "italic" }} {...props} />; }
function BQ(props) {
  return (
    <blockquote style={{
      borderLeft: `2px solid ${BURGUNDY}`, paddingLeft: 16, margin: "20px 0",
      fontFamily: SERIF, fontStyle: "italic", color: SUB, fontSize: 16,
    }} {...props} />
  );
}

function SellTrigger({ children }) {
  return (
    <div style={{
      borderLeft: `2px solid ${BURGUNDY}`, background: "rgba(139,26,26,0.05)",
      padding: 14, margin: "20px 0",
      fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: NEAR_BLACK, lineHeight: 1.6,
    }}>{children}</div>
  );
}

function FinancialsGrid({ data = [] }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px", margin: "16px 0", padding: 0 }}>
      {data.map((row, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <dt style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: SUB, margin: 0 }}>{row.label}</dt>
          <dd style={{ fontFamily: SERIF, fontSize: 14, color: NEAR_BLACK, fontVariantNumeric: "tabular-nums", margin: 0, fontWeight: 600 }}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const mdxComponents = {
  TrendChart,
  BarChart,
  ChartPair,
  SellTrigger,
  FinancialsGrid,
  h2: H2, h3: H3, p: P, ul: UL, ol: OL, li: LI,
  strong: Strong, em: Em, blockquote: BQ,
};
