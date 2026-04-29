"use client";

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, ReferenceLine } from "recharts";

const FONT = "'Be Vietnam Pro', sans-serif";

const COLORS = {
  primary: "#1a3a5c",      // kept for logo gradient / button backgrounds only
  accent: "#2563eb",       // buttons and interactive elements only
  accentLight: "#3b82f6",
  accentPale: "#dbeafe",
  accentFaint: "#eff6ff",
  green: "#059669",        // profit / positive P&L only
  greenBg: "#ecfdf5",
  red: "#dc2626",          // loss / negative P&L only
  redBg: "#fef2f2",
  orange: "#d97706",
  orangeBg: "#fffbeb",
  gray100: "#f8fafc",
  gray200: "#e2e8f0",
  gray300: "#cbd5e1",
  gray400: "#94a3b8",
  gray500: "#64748b",
  gray600: "#475569",
  white: "#ffffff",
  // Typography
  text: "#111111",         // all primary text
  textSub: "#555555",      // secondary / meta text
};

const SECTOR_COLORS = ["#2563eb","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#db2777","#0d9488","#4f46e5","#ca8a04","#6366f1"];
const TABS = ["Portfolio", "Analysis"];

const DEFAULT_PORTFOLIO = {
  "TS-8 Fund": {
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
    <div style={{ background: COLORS.white, borderRadius: 14, border: `1px solid ${COLORS.gray200}`, padding: "24px", ...style }}>
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

function HoldingsTable({ holdings, onDelete }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COLORS.gray200}` }}>
            {["Ticker","Shares","Cost Basis","Current","Mkt Value","P/L","P/L %","Sector",""].map(h => (
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
                <td style={{ padding: "12px" }}>
                  <button onClick={() => onDelete(i)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
                </td>
              </tr>
            );
          })}
          {!holdings.length && <tr><td colSpan={9} style={{ padding: 30, textAlign: "center", color: COLORS.textSub }}>No holdings yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TradesTable({ trades, onDelete }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COLORS.gray200}` }}>
            {["Date","Action","Ticker","Shares","Price","Total","Rationale",""].map(h => (
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
              <td style={{ padding: "12px" }}>
                <button onClick={() => onDelete(i)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
              </td>
            </tr>
          ))}
          {!trades.length && <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: COLORS.textSub }}>No trades logged yet</td></tr>}
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
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: COLORS.textSub, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: 0.5 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: 32, width: 440, maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 20px", color: COLORS.text, fontSize: 19, fontFamily: FONT }}>Add Holding</h3>
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
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
          <button onClick={submit} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600 }}>Add Position</button>
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
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit" };
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
      <div style={{ background: COLORS.white, borderRadius: 16, padding: 32, width: 500, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: COLORS.text, fontSize: 19, fontFamily: FONT }}>Log Trade</h3>
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
              <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
              <button onClick={parsePaste} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600 }}>Import Trades</button>
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
              <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
              <button onClick={submitManual} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600 }}>Log Trade</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Memo components ── */
function MemoCard({ memo, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={{ marginBottom: 14, cursor: "pointer", border: `1px solid ${expanded ? COLORS.accentLight : COLORS.gray200}` }}>
      <div onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 13, background: COLORS.gray100, padding: "3px 10px", borderRadius: 6, border: `1px solid ${COLORS.gray200}` }}>{memo.ticker}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: memo.status === "Active" ? COLORS.greenBg : memo.status === "Closed" ? COLORS.redBg : COLORS.gray100, color: memo.status === "Active" ? COLORS.green : memo.status === "Closed" ? COLORS.red : COLORS.text }}>{memo.status}</span>
            </div>
            <h4 style={{ margin: 0, fontSize: 16, color: COLORS.text, fontFamily: FONT }}>{memo.title}</h4>
          </div>
          <div style={{ fontSize: 13, color: COLORS.textSub }}>{memo.date}</div>
        </div>
        {expanded && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.gray200}` }}>
            <p style={{ margin: 0, color: COLORS.textSub, lineHeight: 1.7, fontSize: 14, whiteSpace: "pre-wrap" }}>{memo.thesis}</p>
            <button onClick={(e) => { e.stopPropagation(); onDelete(memo.id); }} style={{ marginTop: 14, padding: "6px 14px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Delete Memo</button>
          </div>
        )}
      </div>
    </Card>
  );
}

function AddMemoForm({ onAdd, onClose }) {
  const [form, setForm] = useState({ ticker: "", title: "", thesis: "", status: "Active" });
  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: COLORS.textSub, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: 0.5 };
  const submit = () => {
    if (!form.ticker || !form.title || !form.thesis) return;
    onAdd({ id: Date.now(), ticker: form.ticker.toUpperCase(), title: form.title, thesis: form.thesis, date: new Date().toISOString().slice(0,10), status: form.status });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: 32, width: 540, maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 20px", color: COLORS.text, fontSize: 19, fontFamily: FONT }}>New Investment Memo</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Ticker</label><input style={inputStyle} value={form.ticker} onChange={handle("ticker")} placeholder="e.g. MSFT" /></div>
            <div><label style={labelStyle}>Status</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.status} onChange={handle("status")}>
                <option value="Active">Active</option><option value="Watchlist">Watchlist</option><option value="Closed">Closed</option>
              </select>
            </div>
          </div>
          <div><label style={labelStyle}>Title</label><input style={inputStyle} value={form.title} onChange={handle("title")} placeholder="Investment thesis title" /></div>
          <div><label style={labelStyle}>Thesis</label><textarea style={{ ...inputStyle, height: 180, resize: "vertical" }} value={form.thesis} onChange={handle("thesis")} placeholder="Bull case, key risks, catalysts, valuation rationale..." /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${COLORS.gray200}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
          <button onClick={submit} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600 }}>Save Memo</button>
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
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [benchmarkRange, setBenchmarkRange] = useState("3mo");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ts8-portfolio-data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.portfolios) setPortfolios(parsed.portfolios);
        if (parsed.memos) setMemos(parsed.memos);
      }
    } catch (e) { /* first load */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("ts8-portfolio-data", JSON.stringify({ portfolios, memos }));

    } catch (e) { console.error("Save error:", e); }
  }, [portfolios, memos, loaded]);

  const currentPortfolioKey = "TS-8 Fund";
  const portfolio = portfolios[currentPortfolioKey] || { accountValue: 0, holdings: [], trades: [] };

  const { quotes, lastUpdated, loading: quotesLoading, refetch } = useLiveQuotes(portfolio.holdings, loaded);
  const benchmarkData = useBenchmark(benchmarkRange);

  const liveHoldings = applyLiveQuotes(portfolio.holdings, quotes);
  const metrics = calcPortfolioMetrics(liveHoldings);
  const sectorData = getSectorData(liveHoldings);

  const updatePortfolio = (key, updater) => setPortfolios(prev => ({ ...prev, [key]: updater(prev[key]) }));
  const addHolding = (h) => updatePortfolio(currentPortfolioKey, p => ({ ...p, holdings: [...p.holdings, h] }));
  const deleteHolding = (i) => updatePortfolio(currentPortfolioKey, p => ({ ...p, holdings: p.holdings.filter((_, j) => j !== i) }));
  const addTrades = (ts) => updatePortfolio(currentPortfolioKey, p => ({ ...p, trades: [...p.trades, ...ts] }));
  const deleteTrade = (i) => {
    const sorted = portfolio.trades.slice().sort((a, b) => b.date.localeCompare(a.date));
    const toRemove = sorted[i];
    updatePortfolio(currentPortfolioKey, p => {
      const idx = p.trades.indexOf(toRemove);
      return { ...p, trades: p.trades.filter((_, j) => j !== idx) };
    });
  };
  const addMemo = (m) => setMemos(prev => [m, ...prev]);
  const deleteMemo = (id) => setMemos(prev => prev.filter(m => m.id !== id));

  const btnStyle = (active) => ({
    padding: "10px 24px", borderRadius: 10, border: "none",
    background: active ? COLORS.accent : "transparent",
    color: active ? COLORS.white : COLORS.gray500,
    cursor: "pointer", fontWeight: 700, fontSize: 14,
    transition: "all 0.2s", fontFamily: FONT,
  });

  const actionBtn = {
    padding: "10px 20px", borderRadius: 10, border: `2px solid ${COLORS.accent}`,
    background: COLORS.white, color: COLORS.accent, cursor: "pointer",
    fontWeight: 700, fontSize: 13, transition: "all 0.2s", fontFamily: FONT,
  };

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: FONT, color: COLORS.textSub }}>
      Loading portfolio data...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${COLORS.accentFaint} 0%, ${COLORS.gray100} 100%)`, fontFamily: FONT, color: COLORS.text }}>
      {/* Header */}
      <div style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.gray200}`, padding: "0 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 70 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.primary})`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: COLORS.white, fontWeight: 800, fontSize: 16 }}>TS</span>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 22, color: COLORS.text, fontWeight: 400 }}>TS-8 Capital</span>
          </div>
          <div style={{ display: "flex", gap: 4, background: COLORS.gray100, borderRadius: 12, padding: 4 }}>
            {TABS.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} style={btnStyle(activeTab === i)}>{tab}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 40px" }}>

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
                <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.text, fontFamily: FONT }}>{fmtUSD(metrics.totalValue || portfolio.accountValue)}</div>
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
                  <h3 style={{ margin: 0, color: COLORS.text, fontSize: 17, fontFamily: FONT }}>S&P 500 Benchmark</h3>
                  <div style={{ display: "flex", gap: 4, background: COLORS.gray100, borderRadius: 8, padding: 3 }}>
                    {[["1mo","1M"],["3mo","3M"],["6mo","6M"],["1y","1Y"],["ytd","YTD"]].map(([val, label]) => (
                      <button key={val} onClick={() => setBenchmarkRange(val)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: benchmarkRange === val ? COLORS.accent : "transparent", color: benchmarkRange === val ? COLORS.white : COLORS.gray500 }}>{label}</button>
                    ))}
                  </div>
                </div>
                <PerfChart benchmarkData={benchmarkData} range={benchmarkRange} />
              </Card>
              <Card>
                <h3 style={{ margin: "0 0 8px", color: COLORS.text, fontSize: 17, fontFamily: FONT }}>Sector Allocation</h3>
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
                <h3 style={{ margin: 0, color: COLORS.text, fontSize: 17, fontFamily: FONT }}>Current Holdings</h3>
                <button onClick={() => setShowAddHolding(true)} style={actionBtn}>+ Add Position</button>
              </div>
              <HoldingsTable holdings={liveHoldings} onDelete={deleteHolding} />
            </Card>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: COLORS.text, fontSize: 17, fontFamily: FONT }}>Executed Trades</h3>
                <button onClick={() => setShowAddTrade(true)} style={actionBtn}>+ Log Trade</button>
              </div>
              <TradesTable trades={portfolio.trades} onDelete={deleteTrade} />
            </Card>
          </div>
        )}

        {/* ANALYSIS TAB */}
        {activeTab === 1 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, color: COLORS.text, fontSize: 24, fontFamily: FONT }}>Independent Analysis</h2>
                <p style={{ margin: "6px 0 0", color: COLORS.textSub, fontSize: 14 }}>Original investment research and financial analysis.</p>
              </div>
              <button onClick={() => setShowAddMemo(true)} style={{ ...actionBtn, background: COLORS.accent, color: COLORS.white }}>+ New Memo</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              <Card><MetricCard label="Total Memos" value={memos.length} /></Card>
              <Card><MetricCard label="Active" value={memos.filter(m => m.status === "Active").length} color={COLORS.green} /></Card>
              <Card><MetricCard label="Watchlist" value={memos.filter(m => m.status === "Watchlist").length} color={COLORS.accent} /></Card>
            </div>
            {memos.map(m => <MemoCard key={m.id} memo={m} onDelete={deleteMemo} />)}
            {!memos.length && (
              <Card style={{ textAlign: "center", padding: 60 }}>
                <div style={{ color: COLORS.textSub, fontSize: 16 }}>No memos yet. Write your first investment thesis.</div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddHolding && <AddHoldingForm onAdd={addHolding} onClose={() => setShowAddHolding(false)} />}
      {showAddTrade && <AddTradeForm onAdd={addTrades} onClose={() => setShowAddTrade(false)} />}
      {showAddMemo && <AddMemoForm onAdd={addMemo} onClose={() => setShowAddMemo(false)} />}
    </div>
  );
}
