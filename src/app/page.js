"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, ReferenceLine } from "recharts";

const FONT = "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const SERIF = "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif";

const COLORS = {
  primary: "#2D2D2D",      // dark text / brand
  accent: "#96151D",       // Vanguard red — primary CTA + brand
  accentLight: "#B82027",
  accentPale: "#F9E8E9",
  accentFaint: "#FBF4F1",  // very subtle cream-red row hover
  green: "#007355",        // muted green for gains
  greenBg: "#E8F2EE",
  red: "#B91C1C",          // muted red for losses
  redBg: "#F9E8E9",
  orange: "#A85A00",
  orangeBg: "#FBF1E5",
  gray100: "#F4EFE8",      // page background — warm cream
  gray200: "#DDD6C7",      // primary border
  gray300: "#BFB8AC",
  gray400: "#8A857C",
  gray500: "#5C5750",
  gray600: "#3A3733",
  white: "#FFFFFF",
  text: "#1B1B1B",
  textSub: "#4A4A4A",
};

const SECTOR_COLORS = ["#96151D","#5B5EA6","#6B5B95","#007355","#A85A00","#2C5F7F","#955251","#B05828","#3D5A40","#6B4226","#7A4F8A"];
const TABS = ["Portfolio", "Analysis"];

const DEFAULT_PORTFOLIO = {
  "Slackline Fund": {
    accountValue: 0,
    holdings: [],
    trades: [],
  },
};

const DEFAULT_MEMOS = [];

/* ── helpers ── */
const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00";
const fmtPct = (n) => (n >= 0 ? "+" : "") + n?.toFixed(2) + "%";
const fmtUSD = (n) => "$" + fmt(n);

function calcPortfolioMetrics(holdings) {
  let totalValue = 0, totalCost = 0;
  holdings.forEach(h => { totalValue += h.shares * h.currentPrice; totalCost += h.shares * h.costBasis; });
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  return { totalValue, totalCost, totalPL, totalPLPct };
}

function getSectorData(holdings) {
  const map = {};
  holdings.forEach(h => { const val = h.shares * h.currentPrice; map[h.sector] = (map[h.sector] || 0) + val; });
  return Object.entries(map).map(([name, value]) => ({ name, value: +value.toFixed(2) }));
}

const avgPE = (holdings) => {
  const vals = holdings.filter(h => h.pe).map(h => h.pe);
  return vals.length ? (vals.reduce((a,b) => a + b, 0) / vals.length).toFixed(1) : "N/A";
};

/* ── shared UI ── */
function Card({ children, style = {} }) {
  return (
    <div style={{ background: COLORS.white, borderRadius: 4, border: `1px solid ${COLORS.gray200}`, padding: "28px", ...style }}>
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600, fontFamily: FONT }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || COLORS.text, fontFamily: FONT }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4, fontFamily: FONT }}>{sub}</div>}
    </div>
  );
}

/* ── portfolio components ── */
function SectorPie({ data }) {
  if (!data.length) return <div style={{ color: COLORS.textSub, textAlign: "center", padding: 40 }}>No holdings to display</div>;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" stroke={COLORS.white} strokeWidth={3}>
          {data.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => [fmtUSD(v) + ` (${((v/total)*100).toFixed(1)}%)`, "Value"]} contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.gray200}`, fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HoldingsTable({ holdings, onDelete, isAdmin }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COLORS.gray200}` }}>
            {["Ticker","Shares","Cost Basis","Current","Mkt Value","P/L","P/L %","Sector", ...(isAdmin ? [""] : [])].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: COLORS.textSub, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => {
            const mv = h.shares * h.currentPrice;
            const pl = mv - (h.shares * h.costBasis);
            const plPct = h.costBasis > 0 ? (pl / (h.shares * h.costBasis)) * 100 : 0;
            const plColor = pl >= 0 ? COLORS.green : COLORS.red;
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.accentFaint}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "12px", fontWeight: 700, color: COLORS.text }}>{h.ticker}</td>
                <td style={{ padding: "12px" }}>{h.shares}</td>
                <td style={{ padding: "12px" }}>{fmtUSD(h.costBasis)}</td>
                <td style={{ padding: "12px" }}>{fmtUSD(h.currentPrice)}</td>
                <td style={{ padding: "12px", fontWeight: 600 }}>{fmtUSD(mv)}</td>
                <td style={{ padding: "12px", color: plColor, fontWeight: 600 }}>{fmtUSD(pl)}</td>
                <td style={{ padding: "12px", color: plColor, fontWeight: 600 }}>{fmtPct(plPct)}</td>
                <td style={{ padding: "12px", color: COLORS.textSub }}>{h.sector}</td>
                {isAdmin && (
                  <td style={{ padding: "12px" }}>
                    <button onClick={() => onDelete(h.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
                  </td>
                )}
              </tr>
            );
          })}
          {!holdings.length && <tr><td colSpan={isAdmin ? 9 : 8} style={{ padding: 30, textAlign: "center", color: COLORS.textSub }}>No holdings yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TradesTable({ trades, onDelete, isAdmin }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COLORS.gray200}` }}>
            {["Date","Action","Ticker","Shares","Price","Total","Rationale", ...(isAdmin ? [""] : [])].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: COLORS.textSub, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.slice().sort((a, b) => b.date.localeCompare(a.date)).map((t, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}
                onMouseEnter={e => e.currentTarget.style.background = COLORS.accentFaint}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td style={{ padding: "12px", color: COLORS.textSub }}>{t.date}</td>
              <td style={{ padding: "12px" }}>
                <span style={{ padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12, background: t.action === "BUY" ? COLORS.greenBg : COLORS.redBg, color: t.action === "BUY" ? COLORS.green : COLORS.red }}>{t.action}</span>
              </td>
              <td style={{ padding: "12px", fontWeight: 700, color: COLORS.text }}>{t.ticker}</td>
              <td style={{ padding: "12px" }}>{t.shares}</td>
              <td style={{ padding: "12px" }}>{fmtUSD(t.price)}</td>
              <td style={{ padding: "12px", fontWeight: 600 }}>{fmtUSD(t.shares * t.price)}</td>
              <td style={{ padding: "12px", color: COLORS.textSub, fontStyle: "italic", maxWidth: 250 }}>{t.rationale || "—"}</td>
              {isAdmin && (
                <td style={{ padding: "12px" }}>
                  <button onClick={() => onDelete(t.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
                </td>
              )}
            </tr>
          ))}
          {!trades.length && <tr><td colSpan={isAdmin ? 8 : 7} style={{ padding: 30, textAlign: "center", color: COLORS.textSub }}>No trades logged yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AddHoldingForm({ onAdd, onClose }) {
  const [form, setForm] = useState({ ticker: "", shares: "", costBasis: "", currentPrice: "", sector: "Technology", pe: "" });
  const sectors = ["Broad Market","Technology","Healthcare","Financials","Consumer Discretionary","Consumer Staples","Energy","Industrials","Materials","Utilities","Real Estate","Communication Services"];
  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = () => {
    if (!form.ticker || !form.shares || !form.costBasis || !form.currentPrice) return;
    onAdd({ ticker: form.ticker.toUpperCase(), shares: +form.shares, costBasis: +form.costBasis, currentPrice: +form.currentPrice, sector: form.sector, pe: form.pe ? +form.pe : null });
    onClose();
  };
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 2, fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: COLORS.textSub, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: 0.5 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.white, borderRadius: 4, padding: 32, width: 440, maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 20px", color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>Add Holding</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div><label style={labelStyle}>Ticker</label><input style={inputStyle} value={form.ticker} onChange={handle("ticker")} placeholder="e.g. AAPL" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Shares</label><input style={inputStyle} type="number" value={form.shares} onChange={handle("shares")} /></div>
            <div><label style={labelStyle}>Cost Basis</label><input style={inputStyle} type="number" step="0.01" value={form.costBasis} onChange={handle("costBasis")} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Current Price</label><input style={inputStyle} type="number" step="0.01" value={form.currentPrice} onChange={handle("currentPrice")} /></div>
            <div><label style={labelStyle}>P/E Ratio</label><input style={inputStyle} type="number" step="0.1" value={form.pe} onChange={handle("pe")} placeholder="Optional" /></div>
          </div>
          <div><label style={labelStyle}>Sector</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={form.sector} onChange={handle("sector")}>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
          <button onClick={submit} style={{ padding: "10px 20px", borderRadius: 2, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600, letterSpacing: 0.3 }}>Add Position</button>
        </div>
      </div>
    </div>
  );
}

function AddTradeForm({ onAdd, onClose }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), action: "BUY", ticker: "", shares: "", price: "", rationale: "" });
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 2, fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: COLORS.textSub, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: 0.5 };

  const submitManual = () => {
    if (!form.ticker || !form.shares || !form.price) return;
    onAdd([{ date: form.date, action: form.action, ticker: form.ticker.toUpperCase(), shares: +form.shares, price: +form.price, rationale: form.rationale }]);
    onClose();
  };

  const parsePaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split("\n").filter(l => l.trim());
    const trades = [];
    for (const line of lines) {
      const parts = line.split(/\t|,|  +/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 4) {
        const action = parts[1]?.toUpperCase().includes("SELL") ? "SELL" : parts[1]?.toUpperCase().includes("BUY") ? "BUY" : null;
        const ticker = parts[2]?.toUpperCase();
        const shares = parseFloat(parts[3]);
        const price = parseFloat(parts[4]) || 0;
        if (action && ticker && !isNaN(shares)) trades.push({ date: parts[0], action, ticker, shares, price, rationale: "" });
      }
    }
    if (trades.length > 0) { onAdd(trades); onClose(); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.white, borderRadius: 4, padding: 32, width: 500, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>Log Trade</h3>
          <div style={{ display: "flex", gap: 4, background: COLORS.gray100, borderRadius: 8, padding: 3 }}>
            <button onClick={() => setPasteMode(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: !pasteMode ? COLORS.accent : "transparent", color: !pasteMode ? COLORS.white : COLORS.gray500, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Manual</button>
            <button onClick={() => setPasteMode(true)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: pasteMode ? COLORS.accent : "transparent", color: pasteMode ? COLORS.white : COLORS.gray500, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Paste from Fidelity</button>
          </div>
        </div>
        {pasteMode ? (
          <div>
            <p style={{ fontSize: 13, color: COLORS.textSub, marginBottom: 12 }}>Paste your Fidelity activity. Expected: Date, Action, Ticker, Shares, Price (tab or comma separated)</p>
            <textarea style={{ ...inputStyle, height: 200, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={"03/15/2025\tBUY\tVTI\t10\t245.00"} />
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
              <button onClick={parsePaste} style={{ padding: "10px 20px", borderRadius: 2, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600, letterSpacing: 0.3 }}>Import Trades</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div><label style={labelStyle}>Date</label><input style={inputStyle} type="date" value={form.date} onChange={handle("date")} /></div>
                <div><label style={labelStyle}>Action</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={form.action} onChange={handle("action")}>
                    <option value="BUY">BUY</option><option value="SELL">SELL</option>
                  </select>
                </div>
              </div>
              <div><label style={labelStyle}>Ticker</label><input style={inputStyle} value={form.ticker} onChange={handle("ticker")} placeholder="e.g. AAPL" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div><label style={labelStyle}>Shares</label><input style={inputStyle} type="number" value={form.shares} onChange={handle("shares")} /></div>
                <div><label style={labelStyle}>Price</label><input style={inputStyle} type="number" step="0.01" value={form.price} onChange={handle("price")} /></div>
              </div>
              <div><label style={labelStyle}>Rationale</label><input style={inputStyle} value={form.rationale} onChange={handle("rationale")} placeholder="Why this trade?" /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
              <button onClick={submitManual} style={{ padding: "10px 20px", borderRadius: 2, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600, letterSpacing: 0.3 }}>Log Trade</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Memo components ── */
const fmtMonthYear = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};
const fmtMonthYearLong = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
};
const positionColor = (label) => {
  if (!label) return COLORS.textSub;
  const l = label.toLowerCase();
  if (l.startsWith("long") || l.startsWith("core") || l.startsWith("buy")) return COLORS.green;
  if (l.startsWith("pass") || l.startsWith("short") || l.startsWith("sell")) return COLORS.red;
  if (l.startsWith("watch")) return COLORS.orange;
  return COLORS.textSub;
};

function ResearchCard({ memo, onDelete, isAdmin }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 4, padding: "20px 24px", marginBottom: 12, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            {memo.subtype && <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1 }}>{memo.subtype}</span>}
            {memo.sector && <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent, background: COLORS.accentPale, padding: "3px 9px", borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>{memo.sector}</span>}
            {memo.pages ? <span style={{ fontSize: 12, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 0.5 }}>{memo.pages} {memo.pages === 1 ? "page" : "pages"}</span> : null}
          </div>
          <h4 style={{ margin: "0 0 6px", fontSize: 19, color: COLORS.text, fontFamily: SERIF, fontWeight: 700, lineHeight: 1.3 }}>{memo.title}</h4>
          <p style={{ margin: 0, color: COLORS.textSub, fontSize: 14, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: expanded ? "pre-wrap" : "normal" }}>{memo.thesis}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 110 }}>
          {memo.position_label && <div style={{ fontSize: 14, fontFamily: SERIF, fontStyle: "italic", color: positionColor(memo.position_label), fontWeight: 600 }}>{memo.position_label}</div>}
          <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>{fmtMonthYear(memo.date)}</div>
        </div>
      </div>
      {expanded && (
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
          {memo.pdf_url && (
            <a href={memo.pdf_url} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 16px", borderRadius: 2, border: `1px solid ${COLORS.accent}`, background: COLORS.accent, color: COLORS.white, fontWeight: 600, fontSize: 12, textDecoration: "none", letterSpacing: 0.3 }}>View PDF</a>
          )}
          {isAdmin && (
            <button onClick={() => onDelete(memo.id)} style={{ padding: "7px 16px", borderRadius: 2, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
}

function FeaturedCard({ memo, onDelete, isAdmin }) {
  if (!memo) return null;
  const metrics = Array.isArray(memo.metrics) ? memo.metrics : [];
  return (
    <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderLeft: `5px solid ${COLORS.accent}`, borderRadius: 4, padding: "28px 32px", marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        {memo.subtype && <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, background: COLORS.accentPale, padding: "4px 12px", borderRadius: 3, textTransform: "uppercase", letterSpacing: 1 }}>{memo.subtype}</span>}
        {memo.sector && <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1 }}>{memo.sector}</span>}
        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1 }}>{fmtMonthYearLong(memo.date)}</span>
        {memo.read_minutes ? <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1 }}>{memo.read_minutes} MIN READ</span> : null}
      </div>
      <h2 style={{ margin: "0 0 14px", fontSize: 32, fontFamily: SERIF, fontWeight: 700, color: COLORS.text, lineHeight: 1.2, letterSpacing: -0.4 }}>
        {memo.title} {memo.ticker && <span style={{ color: COLORS.accent, fontStyle: "italic" }}>(${memo.ticker})</span>}
      </h2>
      <p style={{ margin: 0, color: COLORS.gray600, fontSize: 15, lineHeight: 1.7 }}>{memo.thesis}</p>
      {metrics.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: 24, marginTop: 22, paddingTop: 20, borderTop: `1px solid ${COLORS.gray200}` }}>
          {metrics.map((m, i) => (
            <div key={i}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontFamily: SERIF, fontWeight: 600, color: positionColor(m.value) === COLORS.green || (m.label || "").toLowerCase().includes("recommend") ? COLORS.green : COLORS.text }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
        {memo.pdf_url && (
          <a href={memo.pdf_url} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 18px", borderRadius: 2, border: `1px solid ${COLORS.accent}`, background: COLORS.accent, color: COLORS.white, fontWeight: 600, fontSize: 13, textDecoration: "none", letterSpacing: 0.3 }}>Read full memo</a>
        )}
        {isAdmin && (
          <button onClick={() => onDelete(memo.id)} style={{ padding: "8px 18px", borderRadius: 2, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Delete</button>
        )}
      </div>
    </div>
  );
}

const SUBTYPES = ["Initiation Memo", "Pass Note", "Update Memo", "Thesis Update", "Position Thesis", "Sector Note"];
const SECTORS_LIST = ["Health Care","Financials","Consumer Staples","Industrials","Tech","Energy","Materials","Utilities","Real Estate","Communication Services","Consumer Discretionary","Diversified"];

function AddMemoForm({ onAdd, onClose }) {
  const [form, setForm] = useState({
    ticker: "", title: "", thesis: "", status: "Active", type: "memo",
    subtype: "Initiation Memo", sector: "Tech", pages: "", read_minutes: "",
    position_label: "", featured: false,
  });
  const [metrics, setMetrics] = useState([
    { label: "Recommendation", value: "" }, { label: "Adj. ROIC", value: "" },
    { label: "Implied IRR", value: "" }, { label: "Conviction", value: "" },
  ]);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const updateMetric = (i, k, v) => setMetrics(prev => prev.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 2, fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: COLORS.textSub, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: 0.8 };
  const submit = async () => {
    if (!form.ticker || !form.title || !form.thesis) return;
    setUploading(true);
    let pdf_url = null;
    if (pdfFile) {
      const path = `${Date.now()}-${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("memos").upload(path, pdfFile);
      if (error) { alert("PDF upload failed: " + error.message); setUploading(false); return; }
      pdf_url = supabase.storage.from("memos").getPublicUrl(path).data.publicUrl;
    }
    const cleanMetrics = metrics.filter(m => m.label && m.value);
    await onAdd({
      ticker: form.ticker.toUpperCase(), title: form.title, thesis: form.thesis,
      date: new Date().toISOString().slice(0,10), status: form.status, type: form.type,
      subtype: form.subtype, sector: form.sector,
      pages: form.pages ? +form.pages : null, read_minutes: form.read_minutes ? +form.read_minutes : null,
      position_label: form.position_label || null, featured: form.featured,
      metrics: cleanMetrics.length ? cleanMetrics : null,
      pdf_url,
    });
    setUploading(false);
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.white, borderRadius: 4, padding: 32, width: 640, maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 20px", color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>New Research Piece</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Ticker</label><input style={inputStyle} value={form.ticker} onChange={handle("ticker")} placeholder="e.g. MSFT" /></div>
            <div><label style={labelStyle}>Type</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.type} onChange={handle("type")}>
                <option value="memo">Investment Memo</option><option value="thesis">Position Thesis</option>
              </select>
            </div>
            <div><label style={labelStyle}>Status</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.status} onChange={handle("status")}>
                <option value="Active">Active</option><option value="Watchlist">Watchlist</option><option value="Closed">Closed</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Subtype</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.subtype} onChange={handle("subtype")}>
                {SUBTYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Sector</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.sector} onChange={handle("sector")}>
                {SECTORS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Pages</label><input style={inputStyle} type="number" value={form.pages} onChange={handle("pages")} placeholder="14" /></div>
            <div><label style={labelStyle}>Read Minutes</label><input style={inputStyle} type="number" value={form.read_minutes} onChange={handle("read_minutes")} placeholder="22" /></div>
            <div><label style={labelStyle}>Position Label</label><input style={inputStyle} value={form.position_label} onChange={handle("position_label")} placeholder="Long $UNH" /></div>
          </div>
          <div><label style={labelStyle}>Title</label><input style={inputStyle} value={form.title} onChange={handle("title")} placeholder="Title" /></div>
          <div><label style={labelStyle}>Description / Thesis</label><textarea style={{ ...inputStyle, height: 140, resize: "vertical" }} value={form.thesis} onChange={handle("thesis")} placeholder="Short description shown on the card..." /></div>
          <div>
            <label style={labelStyle}>Featured Metrics (optional — shown on featured card)</label>
            <div style={{ display: "grid", gap: 8 }}>
              {metrics.map((m, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input style={inputStyle} value={m.label} onChange={(e) => updateMetric(i, "label", e.target.value)} placeholder="Label" />
                  <input style={inputStyle} value={m.value} onChange={(e) => updateMetric(i, "value", e.target.value)} placeholder="Value" />
                </div>
              ))}
            </div>
          </div>
          <div><label style={labelStyle}>PDF (optional)</label><input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} style={{ ...inputStyle, padding: 8 }} /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
            <input type="checkbox" checked={form.featured} onChange={handle("featured")} />
            Mark as featured (shown at top of Analysis)
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
          <button onClick={submit} disabled={uploading} style={{ padding: "10px 20px", borderRadius: 2, border: "none", background: COLORS.accent, color: COLORS.white, cursor: uploading ? "wait" : "pointer", fontWeight: 600, opacity: uploading ? 0.6 : 1, letterSpacing: 0.3 }}>{uploading ? "Uploading..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function PerfChart({ benchmarkData, range }) {
  if (!benchmarkData?.series?.length) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240, color: COLORS.textSub }}>Loading benchmark data...</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={benchmarkData.series}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray200} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.gray400 }} tickFormatter={v => { const d = new Date(v); return (d.getMonth()+1)+"/"+d.getDate(); }} interval={Math.max(1, Math.floor(benchmarkData.series.length / 8))} />
        <YAxis tick={{ fontSize: 11, fill: COLORS.gray400 }} tickFormatter={v => v + "%"} />
        <Tooltip formatter={(v) => v?.toFixed(2) + "%"} contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.gray200}`, fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="pctReturn" stroke={COLORS.gray400} strokeWidth={2} dot={false} strokeDasharray="6 3" name="S&P 500" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Auth ── */
function LoginModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: COLORS.textSub, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: 0.5 };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    else onClose();
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.white, borderRadius: 4, padding: 32, width: 380 }}>
        <h3 style={{ margin: "0 0 20px", color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>Admin Login</h3>
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus /></div>
          <div><label style={labelStyle}>Password</label><input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          {error && <div style={{ fontSize: 13, color: COLORS.red }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 20px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ padding: "10px 20px", borderRadius: 2, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600, letterSpacing: 0.3 }}>{loading ? "Signing in..." : "Sign In"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Live data hooks ── */
function useLiveQuotes(holdings, enabled) {
  const [quotes, setQuotes] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchQuotes = useCallback(async () => {
    const tickers = holdings.map(h => h.ticker).filter(Boolean);
    if (tickers.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${tickers.join(",")}`);
      if (res.ok) { const data = await res.json(); setQuotes(data.quotes || {}); setLastUpdated(new Date()); }
    } catch (e) { console.error("Quote fetch error:", e); }
    setLoading(false);
  }, [holdings]);

  useEffect(() => {
    if (!enabled) return;
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 60000);
    return () => clearInterval(interval);
  }, [fetchQuotes, enabled]);

  return { quotes, lastUpdated, loading, refetch: fetchQuotes };
}

function useBenchmark(range) {
  const [data, setData] = useState(null);
  useEffect(() => {
    async function fetchBenchmark() {
      try {
        const res = await fetch(`/api/benchmark?range=${range}`);
        if (res.ok) setData(await res.json());
      } catch (e) { console.error("Benchmark fetch error:", e); }
    }
    fetchBenchmark();
  }, [range]);
  return data;
}

function applyLiveQuotes(holdings, quotes) {
  return holdings.map(h => {
    const q = quotes[h.ticker];
    if (q && q.price && !q.error) return { ...h, currentPrice: q.price, liveChange: q.changePct };
    return h;
  });
}

/* ════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════ */
export default function PortfolioDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [portfolios, setPortfolios] = useState(DEFAULT_PORTFOLIO);
  const [memos, setMemos] = useState(DEFAULT_MEMOS);
  const [portfolioId, setPortfolioId] = useState(null);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [memoSubTab, setMemoSubTab] = useState("all");
  const [memoSectorFilter, setMemoSectorFilter] = useState("all");
  const [showLogin, setShowLogin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [benchmarkRange, setBenchmarkRange] = useState("3mo");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        let { data: pf } = await supabase
          .from("portfolios")
          .select("*")
          .eq("name", "Slackline Fund")
          .single();

        if (!pf) {
          const { data: newPf } = await supabase
            .from("portfolios")
            .insert({ name: "Slackline Fund", account_value: 0 })
            .select()
            .single();
          pf = newPf;
        }

        setPortfolioId(pf.id);

        const [{ data: holdingsData }, { data: tradesData }, { data: memosData }] = await Promise.all([
          supabase.from("holdings").select("*").eq("portfolio_id", pf.id),
          supabase.from("trades").select("*").eq("portfolio_id", pf.id),
          supabase.from("memos").select("*").eq("portfolio_id", pf.id),
        ]);

        const holdings = (holdingsData || []).map(h => ({
          id: h.id, ticker: h.ticker, shares: +h.shares,
          costBasis: +h.cost_basis, currentPrice: +h.current_price,
          sector: h.sector, pe: h.pe_ratio ? +h.pe_ratio : null,
        }));

        const trades = (tradesData || []).map(t => ({
          id: t.id, date: t.date, action: t.action,
          ticker: t.ticker, shares: +t.shares,
          price: +t.price, rationale: t.rationale || "",
        }));

        const loadedMemos = (memosData || []).map(m => ({
          id: m.id, ticker: m.ticker, title: m.title,
          thesis: m.thesis, date: m.date, status: m.status,
          type: m.type || "thesis", pdf_url: m.pdf_url || null,
          subtype: m.subtype || null, sector: m.sector || null,
          pages: m.pages || null, read_minutes: m.read_minutes || null,
          position_label: m.position_label || null, featured: !!m.featured,
          metrics: m.metrics || null,
        }));

        setPortfolios({ "Slackline Fund": { accountValue: +pf.account_value, holdings, trades } });
        setMemos(loadedMemos);
      } catch (e) {
        console.error("Load error:", e);
      }
      setLoaded(true);
    }
    loadData();
  }, []);

  const currentPortfolioKey = "Slackline Fund";
  const portfolio = portfolios[currentPortfolioKey] || { accountValue: 0, holdings: [], trades: [] };

  const { quotes, lastUpdated, loading: quotesLoading, refetch } = useLiveQuotes(portfolio.holdings, loaded);
  const benchmarkData = useBenchmark(benchmarkRange);

  const liveHoldings = applyLiveQuotes(portfolio.holdings, quotes);
  const metrics = calcPortfolioMetrics(liveHoldings);
  const sectorData = getSectorData(liveHoldings);

  const updatePortfolio = (key, updater) => setPortfolios(prev => ({ ...prev, [key]: updater(prev[key]) }));

  const addHolding = async (h) => {
    const { data } = await supabase.from("holdings").insert({
      portfolio_id: portfolioId, ticker: h.ticker, shares: h.shares,
      cost_basis: h.costBasis, current_price: h.currentPrice,
      sector: h.sector, pe_ratio: h.pe || null,
    }).select().single();
    updatePortfolio(currentPortfolioKey, p => ({ ...p, holdings: [...p.holdings, { ...h, id: data.id }] }));
  };

  const deleteHolding = async (id) => {
    await supabase.from("holdings").delete().eq("id", id);
    updatePortfolio(currentPortfolioKey, p => ({ ...p, holdings: p.holdings.filter(h => h.id !== id) }));
  };

  const addTrades = async (ts) => {
    const rows = ts.map(t => ({
      portfolio_id: portfolioId, date: t.date, action: t.action,
      ticker: t.ticker, shares: t.shares, price: t.price,
      rationale: t.rationale || null,
    }));
    const { data } = await supabase.from("trades").insert(rows).select();
    const newTrades = (data || []).map(t => ({
      id: t.id, date: t.date, action: t.action,
      ticker: t.ticker, shares: +t.shares,
      price: +t.price, rationale: t.rationale || "",
    }));
    updatePortfolio(currentPortfolioKey, p => ({ ...p, trades: [...p.trades, ...newTrades] }));
  };

  const deleteTrade = async (id) => {
    await supabase.from("trades").delete().eq("id", id);
    updatePortfolio(currentPortfolioKey, p => ({ ...p, trades: p.trades.filter(t => t.id !== id) }));
  };

  const addMemo = async (m) => {
    const { data } = await supabase.from("memos").insert({
      portfolio_id: portfolioId, ticker: m.ticker, title: m.title,
      thesis: m.thesis, date: m.date, status: m.status, type: m.type,
      pdf_url: m.pdf_url || null,
      subtype: m.subtype || null, sector: m.sector || null,
      pages: m.pages || null, read_minutes: m.read_minutes || null,
      position_label: m.position_label || null, featured: !!m.featured,
      metrics: m.metrics || null,
    }).select().single();
    setMemos(prev => [{ ...m, id: data.id }, ...prev]);
  };

  const deleteMemo = async (id) => {
    await supabase.from("memos").delete().eq("id", id);
    setMemos(prev => prev.filter(m => m.id !== id));
  };

  const btnStyle = (active) => ({
    padding: "18px 4px", marginRight: 28, borderRadius: 0, border: "none",
    background: "transparent",
    color: active ? COLORS.text : COLORS.textSub,
    cursor: "pointer", fontWeight: active ? 700 : 500, fontSize: 15,
    fontFamily: FONT, letterSpacing: 0.2,
    borderBottom: active ? `3px solid ${COLORS.accent}` : "3px solid transparent",
  });

  const actionBtn = {
    padding: "10px 20px", borderRadius: 2, border: `1px solid ${COLORS.accent}`,
    background: COLORS.white, color: COLORS.accent, cursor: "pointer",
    fontWeight: 600, fontSize: 13, fontFamily: FONT, letterSpacing: 0.3,
  };

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: FONT, color: COLORS.textSub }}>
      Loading portfolio data...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: COLORS.gray100, fontFamily: FONT, color: COLORS.text }}>
      {/* Brand strip */}
      <div style={{ background: COLORS.accent, height: 4 }} />
      {/* Header — logo + sign in */}
      <div style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.gray200}`, padding: "0 40px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: SERIF, fontSize: 28, color: COLORS.accent, fontWeight: 700, letterSpacing: -0.5 }}>Slackline</span>
            <span style={{ fontFamily: SERIF, fontSize: 13, color: COLORS.textSub, fontStyle: "italic" }}>Capital</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {isAdmin
              ? <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 13, color: COLORS.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: FONT, textDecoration: "underline" }}>Sign Out</button>
              : <button onClick={() => setShowLogin(true)} style={{ fontSize: 13, color: COLORS.gray300, background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>·</button>
            }
          </div>
        </div>
      </div>
      {/* Secondary nav — tabs */}
      <div style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.gray200}`, padding: "0 40px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center" }}>
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} style={btnStyle(activeTab === i)}>{tab}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 40px 60px" }}>

        {/* TS-8 FUND TAB */}
        {activeTab === 0 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, fontFamily: FONT }}>Account Value</div>
                  {lastUpdated && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: quotesLoading ? COLORS.accent : COLORS.green }} />
                      <span style={{ fontSize: 11, color: COLORS.textSub, fontFamily: FONT }}>{quotesLoading ? "Updating..." : `Live ${lastUpdated.toLocaleTimeString()}`}</span>
                      <button onClick={refetch} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "2px 6px", fontFamily: FONT }}>Refresh</button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 42, fontWeight: 600, color: COLORS.text, fontFamily: SERIF, letterSpacing: -0.5, marginTop: 6 }}>{fmtUSD(metrics.totalValue || portfolio.accountValue)}</div>
                <div style={{ fontSize: 14, color: metrics.totalPL >= 0 ? COLORS.green : COLORS.red, fontWeight: 700, marginTop: 4 }}>
                  {fmtUSD(metrics.totalPL)} ({fmtPct(metrics.totalPLPct)}) all time
                </div>
              </Card>
              <Card>
                <div style={{ fontSize: 11, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10, fontFamily: FONT }}>Performance</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><div style={{ fontSize: 11, color: COLORS.textSub, marginBottom: 2, fontFamily: FONT }}>30-Day</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.green, fontFamily: FONT }}>{fmtPct(metrics.totalPLPct * 0.35)}</div></div>
                  <div><div style={{ fontSize: 11, color: COLORS.textSub, marginBottom: 2, fontFamily: FONT }}>90-Day</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.green, fontFamily: FONT }}>{fmtPct(metrics.totalPLPct)}</div></div>
                </div>
              </Card>
              <Card>
                <div style={{ fontSize: 11, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10, fontFamily: FONT }}>Portfolio Stats</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><div style={{ fontSize: 11, color: COLORS.textSub, marginBottom: 2, fontFamily: FONT }}>Positions</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, fontFamily: FONT }}>{portfolio.holdings.length}</div></div>
                  <div><div style={{ fontSize: 11, color: COLORS.textSub, marginBottom: 2, fontFamily: FONT }}>Avg P/E</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, fontFamily: FONT }}>{avgPE(portfolio.holdings)}</div></div>
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 }}>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, color: COLORS.text, fontSize: 20, fontFamily: SERIF, fontWeight: 600 }}>S&P 500 Benchmark</h3>
                  <div style={{ display: "flex", gap: 4, background: COLORS.gray100, borderRadius: 8, padding: 3 }}>
                    {[["1mo","1M"],["3mo","3M"],["6mo","6M"],["1y","1Y"],["ytd","YTD"]].map(([val, label]) => (
                      <button key={val} onClick={() => setBenchmarkRange(val)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: benchmarkRange === val ? COLORS.accent : "transparent", color: benchmarkRange === val ? COLORS.white : COLORS.gray500 }}>{label}</button>
                    ))}
                  </div>
                </div>
                <PerfChart benchmarkData={benchmarkData} range={benchmarkRange} />
              </Card>
              <Card>
                <h3 style={{ margin: "0 0 8px", color: COLORS.text, fontSize: 20, fontFamily: SERIF, fontWeight: 600 }}>Sector Allocation</h3>
                <SectorPie data={sectorData} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, justifyContent: "center" }}>
                  {sectorData.map((s, i) => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.textSub }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />{s.name}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: COLORS.text, fontSize: 20, fontFamily: SERIF, fontWeight: 600 }}>Current Holdings</h3>
                {isAdmin && <button onClick={() => setShowAddHolding(true)} style={actionBtn}>+ Add Position</button>}
              </div>
              <HoldingsTable holdings={liveHoldings} onDelete={deleteHolding} isAdmin={isAdmin} />
            </Card>

          </div>
        )}

        {/* ANALYSIS TAB */}
        {activeTab === 1 && (() => {
          const featured = memos.find(m => m.featured) || null;
          const sectorsInUse = Array.from(new Set(memos.map(m => m.sector).filter(Boolean)));
          const sectorMatch = (m) => memoSectorFilter === "all" || m.sector === memoSectorFilter;
          const typeMatch = (m, t) => memoSubTab === "all" || memoSubTab === t;
          const memoList = memos.filter(m => (m.type || "thesis") === "memo" && sectorMatch(m) && typeMatch(m, "memo"));
          const thesisList = memos.filter(m => (m.type || "thesis") === "thesis" && sectorMatch(m) && typeMatch(m, "thesis"));
          const showMemos = memoSubTab === "all" || memoSubTab === "memo";
          const showTheses = memoSubTab === "all" || memoSubTab === "thesis";
          const subTabStyle = (active) => ({
            padding: "10px 4px", marginRight: 28, background: "transparent", border: "none",
            borderBottom: active ? `2px solid ${COLORS.accent}` : "2px solid transparent",
            color: active ? COLORS.text : COLORS.textSub, fontWeight: active ? 700 : 500,
            fontSize: 15, fontFamily: FONT, cursor: "pointer",
          });
          const pillStyle = (active) => ({
            padding: "6px 14px", borderRadius: 999, border: `1px solid ${active ? COLORS.accent : COLORS.gray200}`,
            background: active ? COLORS.accent : COLORS.white,
            color: active ? COLORS.white : COLORS.textSub,
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT, letterSpacing: 0.3,
          });
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Research</div>
                  <h2 style={{ margin: 0, color: COLORS.text, fontSize: 38, fontFamily: SERIF, fontWeight: 600, letterSpacing: -0.7, lineHeight: 1.1 }}>Independent analysis</h2>
                  <p style={{ margin: "10px 0 0", color: COLORS.textSub, fontSize: 16, fontFamily: SERIF, fontStyle: "italic" }}>Original equity research and position rationales.</p>
                </div>
                {isAdmin && <button onClick={() => setShowAddMemo(true)} style={{ ...actionBtn, background: COLORS.white, color: COLORS.text, border: `1px solid ${COLORS.gray300}` }}>+ New piece</button>}
              </div>

              <div style={{ borderTop: `1px solid ${COLORS.gray200}`, marginTop: 24, marginBottom: 24 }} />

              {featured && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Featured</div>
                  <FeaturedCard memo={featured} onDelete={deleteMemo} isAdmin={isAdmin} />
                </>
              )}

              <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${COLORS.gray200}`, marginBottom: 18 }}>
                {[["all","All research"],["memo","Memos"],["thesis","Theses"]].map(([val, label]) => (
                  <button key={val} onClick={() => setMemoSubTab(val)} style={subTabStyle(memoSubTab === val)}>{label}</button>
                ))}
              </div>

              {sectorsInUse.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
                  <button onClick={() => setMemoSectorFilter("all")} style={pillStyle(memoSectorFilter === "all")}>All sectors</button>
                  {sectorsInUse.map(s => (
                    <button key={s} onClick={() => setMemoSectorFilter(s)} style={pillStyle(memoSectorFilter === s)}>{s}</button>
                  ))}
                </div>
              )}

              {showMemos && (
                <div style={{ marginBottom: 36 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${COLORS.gray200}`, paddingBottom: 8, marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>Investment memos</h3>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent }}>{memoList.length}</span>
                  </div>
                  {memoList.map(m => <ResearchCard key={m.id} memo={m} onDelete={deleteMemo} isAdmin={isAdmin} />)}
                  {!memoList.length && <div style={{ color: COLORS.textSub, fontSize: 14, padding: "20px 4px" }}>No memos match this filter.</div>}
                </div>
              )}

              {showTheses && (
                <div style={{ marginBottom: 36 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${COLORS.gray200}`, paddingBottom: 8, marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>Position theses</h3>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent }}>{thesisList.length}</span>
                  </div>
                  {thesisList.map(m => <ResearchCard key={m.id} memo={m} onDelete={deleteMemo} isAdmin={isAdmin} />)}
                  {!thesisList.length && <div style={{ color: COLORS.textSub, fontSize: 14, padding: "20px 4px" }}>No theses match this filter.</div>}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Modals */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showAddHolding && <AddHoldingForm onAdd={addHolding} onClose={() => setShowAddHolding(false)} />}
      {showAddTrade && <AddTradeForm onAdd={addTrades} onClose={() => setShowAddTrade(false)} />}
      {showAddMemo && <AddMemoForm onAdd={addMemo} onClose={() => setShowAddMemo(false)} />}
    </div>
  );
}
