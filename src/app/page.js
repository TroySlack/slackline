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
  green: "#2D6E3A",        // muted green for gains (per design spec)
  greenBg: "#E8F2EE",
  red: "#8B1A1A",          // burgundy for losses (per design spec)
  redBg: "#F9E8E9",
  gold: "#C9A84C",         // tier 2 / accent gold
  goldBg: "rgba(201,168,76,0.18)",
  redBgSoft: "rgba(139,26,26,0.10)",
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

function AddHoldingForm({ onAdd, onClose, initial }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    ticker: initial?.ticker || "",
    shares: initial?.shares ?? "",
    costBasis: initial?.costBasis ?? "",
    currentPrice: initial?.currentPrice ?? "",
    sector: initial?.sector || "Technology",
    pe: initial?.pe ?? "",
    tier: initial?.tier || 1,
    hedge: !!initial?.hedge,
  });
  const sectors = ["Broad Market","Technology","Healthcare","Financials","Consumer Discretionary","Consumer Staples","Energy","Industrials","Materials","Utilities","Real Estate","Communication Services","Diversified core"];
  const [fetching, setFetching] = useState(false);
  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const fetchPrice = async () => {
    const t = form.ticker.trim().toUpperCase();
    if (!t) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${t}`);
      if (res.ok) {
        const data = await res.json();
        const price = data?.quotes?.[t]?.price;
        if (price) setForm(f => ({ ...f, currentPrice: price.toFixed(2) }));
      }
    } catch (e) { /* silent */ }
    setFetching(false);
  };
  const submit = () => {
    if (!form.ticker || !form.shares || !form.costBasis) return;
    // If currentPrice is empty, use costBasis as a temporary placeholder — useLiveQuotes will overwrite on next tick
    const cp = form.currentPrice ? +form.currentPrice : +form.costBasis;
    onAdd({
      ticker: form.ticker.toUpperCase(), shares: +form.shares,
      costBasis: +form.costBasis, currentPrice: cp,
      sector: form.sector, pe: form.pe ? +form.pe : null,
      tier: +form.tier || 1, hedge: !!form.hedge,
    });
    onClose();
  };
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 2, fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: COLORS.textSub, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: 0.5 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.white, borderRadius: 4, padding: 32, width: 480, maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 20px", color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>{isEdit ? "Edit Position" : "Add Position"}</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>Ticker</label>
            <input
              style={inputStyle}
              value={form.ticker}
              onChange={handle("ticker")}
              onBlur={fetchPrice}
              placeholder="e.g. AAPL — current price auto-fills"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Shares</label><input style={inputStyle} type="number" value={form.shares} onChange={handle("shares")} /></div>
            <div><label style={labelStyle}>Cost Basis</label><input style={inputStyle} type="number" step="0.01" value={form.costBasis} onChange={handle("costBasis")} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>
                Current Price {fetching && <span style={{ marginLeft: 6, fontSize: 10, color: COLORS.accent, textTransform: "none", letterSpacing: 0 }}>fetching…</span>}
              </label>
              <input style={inputStyle} type="number" step="0.01" value={form.currentPrice} onChange={handle("currentPrice")} placeholder="Auto-fills from Yahoo" />
            </div>
            <div><label style={labelStyle}>P/E Ratio</label><input style={inputStyle} type="number" step="0.1" value={form.pe} onChange={handle("pe")} placeholder="Optional" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Tier</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.tier} onChange={handle("tier")}>
                <option value={1}>Tier 1 — Conviction core</option>
                <option value={2}>Tier 2 — Diversified tail</option>
              </select>
            </div>
            <div><label style={labelStyle}>Sector</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.sector} onChange={handle("sector")}>
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
            <input type="checkbox" checked={form.hedge} onChange={handle("hedge")} />
            Mark as hedge position
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
          <button onClick={submit} style={{ padding: "10px 20px", borderRadius: 2, border: "none", background: COLORS.accent, color: COLORS.white, cursor: "pointer", fontWeight: 600, letterSpacing: 0.3 }}>{isEdit ? "Save Changes" : "Add Position"}</button>
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

function ResearchCard({ memo, onDelete, onEdit, isAdmin }) {
  const [expanded, setExpanded] = useState(false);
  if (memo.isMdx && memo.slug) {
    return (
      <a href={`/research/${memo.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 4, padding: "20px 24px", marginBottom: 12, cursor: "pointer", transition: "border-color 0.15s" }}
             onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.accent}
             onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.gray200}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                {memo.sector && <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent, background: COLORS.accentPale, padding: "3px 9px", borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>{memo.sector}</span>}
                {memo.read_minutes ? <span style={{ fontSize: 12, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 0.5 }}>{memo.read_minutes} min read</span> : null}
                {memo.ticker && <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSub }}>${memo.ticker}</span>}
              </div>
              <h4 style={{ margin: "0 0 6px", fontSize: 19, color: COLORS.text, fontFamily: SERIF, fontWeight: 700, lineHeight: 1.3 }}>{memo.title}</h4>
              <p style={{ margin: 0, color: COLORS.textSub, fontSize: 14, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{memo.thesis}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, minWidth: 110 }}>
              {memo.position_label && <div style={{ fontSize: 14, fontFamily: SERIF, fontStyle: "italic", color: positionColor(memo.position_label), fontWeight: 600 }}>{memo.position_label}</div>}
              <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 4 }}>{fmtMonthYear(memo.date)}</div>
            </div>
          </div>
        </div>
      </a>
    );
  }
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
            <>
              <button onClick={() => onEdit(memo)} style={{ padding: "7px 16px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, color: COLORS.text, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Edit</button>
              <button onClick={() => onDelete(memo.id)} style={{ padding: "7px 16px", borderRadius: 2, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FeaturedCard({ memo, onDelete, onEdit, isAdmin }) {
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
          <>
            <button onClick={() => onEdit(memo)} style={{ padding: "8px 18px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, color: COLORS.text, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Edit</button>
            <button onClick={() => onDelete(memo.id)} style={{ padding: "8px 18px", borderRadius: 2, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
}

const SUBTYPES = ["Initiation Memo", "Pass Note", "Update Memo", "Thesis Update", "Position Thesis", "Sector Note"];
const SECTORS_LIST = ["Health Care","Financials","Consumer Staples","Industrials","Tech","Energy","Materials","Utilities","Real Estate","Communication Services","Consumer Discretionary","Diversified"];

function AddMemoForm({ onAdd, onClose, initial }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    ticker: initial?.ticker || "", title: initial?.title || "", thesis: initial?.thesis || "",
    status: initial?.status || "Active", type: initial?.type || "memo",
    subtype: initial?.subtype || "", sector: initial?.sector || "",
    pages: initial?.pages ?? "", read_minutes: initial?.read_minutes ?? "",
    position_label: initial?.position_label || "", featured: !!initial?.featured,
  });
  const initialMetrics = Array.isArray(initial?.metrics) && initial.metrics.length
    ? [...initial.metrics, ...Array(Math.max(0, 4 - initial.metrics.length)).fill({ label: "", value: "" })].slice(0, 4)
    : [{ label: "Recommendation", value: "" }, { label: "Adj. ROIC", value: "" }, { label: "Implied IRR", value: "" }, { label: "Conviction", value: "" }];
  const [metrics, setMetrics] = useState(initialMetrics);
  const [pdfFile, setPdfFile] = useState(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const updateMetric = (i, k, v) => setMetrics(prev => prev.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.gray200}`, borderRadius: 2, fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: COLORS.textSub, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: 0.8 };
  const submit = async () => {
    setUploading(true);
    let pdf_url = isEdit ? (initial.pdf_url || null) : null;
    if (removePdf) pdf_url = null;
    if (pdfFile) {
      const path = `${Date.now()}-${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("memos").upload(path, pdfFile);
      if (error) { alert("PDF upload failed: " + error.message); setUploading(false); return; }
      pdf_url = supabase.storage.from("memos").getPublicUrl(path).data.publicUrl;
    }
    const cleanMetrics = metrics.filter(m => m.label && m.value);
    await onAdd({
      ticker: form.ticker ? form.ticker.toUpperCase() : null,
      title: form.title || null, thesis: form.thesis || null,
      date: isEdit ? initial.date : new Date().toISOString().slice(0,10),
      status: form.status, type: form.type,
      subtype: form.subtype || null, sector: form.sector || null,
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
        <h3 style={{ margin: "0 0 20px", color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>{isEdit ? "Edit Research Piece" : "New Research Piece"}</h3>
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
                <option value="">— None —</option>
                {SUBTYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Sector</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.sector} onChange={handle("sector")}>
                <option value="">— None —</option>
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
          <div>
            <label style={labelStyle}>PDF (optional)</label>
            {isEdit && initial.pdf_url && !removePdf && !pdfFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13, color: COLORS.textSub }}>
                <a href={initial.pdf_url} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.accent }}>Current PDF</a>
                <button type="button" onClick={() => setRemovePdf(true)} style={{ padding: "4px 10px", fontSize: 11, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, borderRadius: 2, cursor: "pointer", fontWeight: 600 }}>Remove</button>
              </div>
            )}
            <input type="file" accept="application/pdf" onChange={(e) => { setPdfFile(e.target.files?.[0] || null); setRemovePdf(false); }} style={{ ...inputStyle, padding: 8 }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
            <input type="checkbox" checked={form.featured} onChange={handle("featured")} />
            Mark as featured (shown at top of Analysis)
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 2, border: `1px solid ${COLORS.gray300}`, background: COLORS.white, cursor: "pointer", fontWeight: 600, color: COLORS.textSub }}>Cancel</button>
          <button onClick={submit} disabled={uploading} style={{ padding: "10px 20px", borderRadius: 2, border: "none", background: COLORS.accent, color: COLORS.white, cursor: uploading ? "wait" : "pointer", fontWeight: 600, opacity: uploading ? 0.6 : 1, letterSpacing: 0.3 }}>{uploading ? "Saving..." : (isEdit ? "Save Changes" : "Save")}</button>
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

function useBenchmark(range, start) {
  const [data, setData] = useState(null);
  useEffect(() => {
    async function fetchBenchmark() {
      try {
        const url = start ? `/api/benchmark?start=${start}` : `/api/benchmark?range=${range}`;
        const res = await fetch(url);
        if (res.ok) setData(await res.json());
      } catch (e) { console.error("Benchmark fetch error:", e); }
    }
    fetchBenchmark();
  }, [range, start]);
  return data;
}

function useFundHistory(holdings, start) {
  const [data, setData] = useState(null);
  const tickersKey = holdings.map(h => `${h.ticker}:${h.shares}`).sort().join(",");
  useEffect(() => {
    if (!start || !holdings.length) { setData(null); return; }
    async function fetchHistory() {
      try {
        const tickers = holdings.map(h => h.ticker).join(",");
        const shares = holdings.map(h => h.shares).join(",");
        const res = await fetch(`/api/fund-history?tickers=${tickers}&shares=${shares}&start=${start}`);
        if (res.ok) setData(await res.json());
      } catch (e) { console.error("Fund history fetch error:", e); }
    }
    fetchHistory();
  }, [tickersKey, start]); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}

function applyLiveQuotes(holdings, quotes) {
  return holdings.map(h => {
    const q = quotes[h.ticker];
    if (q && q.price && !q.error) return { ...h, currentPrice: q.price, liveChange: q.changePct };
    return h;
  });
}

/* ── New portfolio components ── */
function StatCell({ label, value, subtitle, color, last }) {
  return (
    <div style={{ flex: 1, padding: "20px 24px", borderRight: last ? "none" : `1px solid ${COLORS.gray200}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 32, fontFamily: SERIF, fontWeight: 600, color: color || COLORS.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5, lineHeight: 1.05 }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 6, fontStyle: "italic", fontFamily: SERIF }}>{subtitle}</div>}
    </div>
  );
}

function FourStatStrip({ stats }) {
  return (
    <div style={{ display: "flex", background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 4, marginBottom: 24 }}>
      {stats.map((s, i) => <StatCell key={i} {...s} last={i === stats.length - 1} />)}
    </div>
  );
}

function IndexedPerfChart({ fundSeries, benchmarkSeries, inceptionDate }) {
  if (!benchmarkSeries?.length) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: COLORS.textSub }}>Loading performance data…</div>;
  }
  // Merge fund and benchmark by date
  const fundMap = new Map((fundSeries || []).map(d => [d.date, d.indexed]));
  const merged = benchmarkSeries.map(d => ({
    date: d.date,
    fund: fundMap.has(d.date) ? fundMap.get(d.date) : null,
    bench: d.indexed != null ? d.indexed : (100 + (d.pctReturn || 0)),
  }));
  // Forward-fill fund line so it's continuous
  let lastFund = 100;
  for (const row of merged) {
    if (row.fund == null) row.fund = lastFund;
    else lastFund = row.fund;
  }
  const last = merged[merged.length - 1] || { fund: 100, bench: 100 };
  const fmtTick = (v) => { const d = new Date(v); return (d.getMonth()+1)+"/"+d.getDate(); };
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={merged} margin={{ top: 20, right: 70, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray200} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.gray400 }} tickFormatter={fmtTick} interval={Math.max(1, Math.floor(merged.length / 6))} />
        <YAxis tick={{ fontSize: 11, fill: COLORS.gray400 }} domain={["auto","auto"]} tickFormatter={v => "+" + (v - 100).toFixed(1) + "%"} />
        <Tooltip formatter={(v, name) => [(v - 100 >= 0 ? "+" : "") + (v - 100).toFixed(2) + "%", name]} contentStyle={{ borderRadius: 4, border: `1px solid ${COLORS.gray200}`, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {inceptionDate && (
          <ReferenceLine x={inceptionDate} stroke={COLORS.gold} strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: "INCEPTION", position: "insideTopLeft", fill: COLORS.gold, fontSize: 10, fontWeight: 700, letterSpacing: 1 }} />
        )}
        <Line type="monotone" dataKey="fund" stroke={COLORS.accent} strokeWidth={2} dot={false} name="Slackline Capital" connectNulls
          label={{ position: "right", value: "+" + (last.fund - 100).toFixed(2) + "%", fill: COLORS.accent, fontSize: 11, fontWeight: 700, content: ({ x, y, value, index }) => index === merged.length - 1 ? <text x={x + 6} y={y + 4} fill={COLORS.accent} fontSize={11} fontWeight={700}>{(value - 100 >= 0 ? "+" : "") + (value - 100).toFixed(2) + "%"}</text> : null }} />
        <Line type="monotone" dataKey="bench" stroke={COLORS.gray500} strokeWidth={1.5} dot={false} strokeDasharray="5 4" name="S&P 500" connectNulls
          label={{ position: "right", content: ({ x, y, value, index }) => index === merged.length - 1 ? <text x={x + 6} y={y + 4} fill={COLORS.gray500} fontSize={11} fontWeight={700}>{(value - 100 >= 0 ? "+" : "") + (value - 100).toFixed(2) + "%"}</text> : null }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function WeightBar({ pct, color, max = 25 }) {
  const w = Math.min(100, (pct / max) * 100);
  return (
    <div style={{ flex: 1, height: 8, background: COLORS.gray100, borderRadius: 1, overflow: "hidden" }}>
      <div style={{ width: w + "%", height: "100%", background: color }} />
    </div>
  );
}

function PortfolioStructure({ holdings }) {
  const totalValue = holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0);
  const withWeight = holdings.map(h => ({ ...h, weight: totalValue > 0 ? ((h.shares * h.currentPrice) / totalValue) * 100 : 0 }));
  const tier1 = withWeight.filter(h => h.tier === 1).sort((a, b) => b.weight - a.weight);
  const tier2 = withWeight.filter(h => h.tier === 2).sort((a, b) => b.weight - a.weight);
  const tier1Total = tier1.reduce((s, h) => s + h.weight, 0);
  const tier2Total = tier2.reduce((s, h) => s + h.weight, 0);

  const SectionHeader = ({ title, count, total }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${COLORS.gray200}` }}>
      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text, fontFamily: FONT, textTransform: "uppercase", letterSpacing: 0.8 }}>{title}</h4>
      <div style={{ fontSize: 12, color: COLORS.textSub, fontFamily: FONT }}>{count} positions, {total.toFixed(0)}%</div>
    </div>
  );

  return (
    <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 4, padding: "24px 28px" }}>
      <h3 style={{ margin: "0 0 4px", fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: COLORS.text }}>Portfolio structure</h3>
      <p style={{ margin: "0 0 22px", fontStyle: "italic", color: COLORS.textSub, fontSize: 13, fontFamily: SERIF }}>By weight, excluding cash.</p>

      <div style={{ marginBottom: 28 }}>
        <SectionHeader title="Tier 1 — Conviction core" count={tier1.length} total={tier1Total} />
        <div style={{ display: "grid", gap: 10 }}>
          {tier1.map(h => (
            <div key={h.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr 50px", gap: 14, alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 13, fontFamily: FONT }}>
                {h.ticker}
                {h.hedge && <span style={{ marginLeft: 6, fontSize: 10, fontStyle: "italic", color: COLORS.textSub, fontWeight: 400 }}>hedge</span>}
              </span>
              <WeightBar pct={h.weight} color={COLORS.accent} max={25} />
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{h.weight.toFixed(0)}%</span>
            </div>
          ))}
          {!tier1.length && <div style={{ color: COLORS.textSub, fontSize: 13, padding: "10px 0" }}>No Tier 1 positions yet.</div>}
        </div>
      </div>

      <div>
        <SectionHeader title="Tier 2 — Diversified tail" count={tier2.length} total={tier2Total} />
        <div style={{ display: "grid", gridTemplateColumns: tier2.length > 4 ? "1fr 1fr" : "1fr", gap: "10px 24px" }}>
          {tier2.map(h => (
            <div key={h.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr 44px", gap: 12, alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 13, fontFamily: FONT }}>
                {h.ticker}
                {h.hedge && <span style={{ marginLeft: 6, fontSize: 10, fontStyle: "italic", color: COLORS.textSub, fontWeight: 400 }}>hedge</span>}
              </span>
              <WeightBar pct={h.weight} color={COLORS.gold} max={20} />
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{h.weight.toFixed(0)}%</span>
            </div>
          ))}
          {!tier2.length && <div style={{ color: COLORS.textSub, fontSize: 13, padding: "10px 0" }}>No Tier 2 positions yet.</div>}
        </div>
      </div>
    </div>
  );
}

function InvestmentMandate() {
  const para = { margin: "0 0 14px", color: COLORS.gray600, fontSize: 14, lineHeight: 1.65, fontFamily: SERIF };
  const dlLabel = { fontSize: 10, fontWeight: 700, color: COLORS.textSub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };
  const dlValue = { fontSize: 14, color: COLORS.text, fontFamily: SERIF, fontWeight: 600 };
  return (
    <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 4, padding: "24px 28px" }}>
      <h3 style={{ margin: "0 0 16px", fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: COLORS.text }}>Investment mandate</h3>
      <p style={para}>A concentrated U.S. equity book run as personal capital. Positions are taken with a multi-year horizon and sized to reflect conviction — five Tier 1 ideas with hard 20% caps, balanced by a diversified tail of smaller positions across the broader market.</p>
      <p style={para}>The thesis is barbell construction. Tier 1 expresses a directional bet on AI infrastructure and durable enterprise software; Tier 2 dampens drawdowns through breadth, sector dispersion, and a deliberate hedge in mature consumer technology.</p>
      <p style={{ ...para, margin: "0 0 22px" }}>Apple is held as a structural hedge, not a thesis position — it is sized to participate in defensive rotations rather than to lead.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px", paddingTop: 18, borderTop: `1px solid ${COLORS.gray200}` }}>
        <div><div style={dlLabel}>Strategy</div><div style={dlValue}>Concentrated long-only U.S. equity</div></div>
        <div><div style={dlLabel}>Horizon</div><div style={dlValue}>3–5 years</div></div>
        <div><div style={dlLabel}>Position cap</div><div style={dlValue}>20% (Tier 1) · 8% (Tier 2)</div></div>
        <div><div style={dlLabel}>Sector cap</div><div style={dlValue}>40% (ex-diversified core)</div></div>
      </div>
    </div>
  );
}

function NewHoldingsTable({ holdings, memos, mdxByTicker, onEdit, onDelete, onResearchClick, isAdmin }) {
  const totalValue = holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0);
  const memoByTicker = new Map();
  memos.forEach(m => {
    if (!m.ticker) return;
    const existing = memoByTicker.get(m.ticker);
    if (!existing || (m.type === "memo" && existing.type !== "memo")) memoByTicker.set(m.ticker, m);
  });

  const TierBadge = ({ tier }) => (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3, marginRight: 8,
      background: tier === 1 ? COLORS.redBgSoft : COLORS.goldBg,
      color: tier === 1 ? COLORS.accent : "#8A6F1F",
      letterSpacing: 0.5,
    }}>T{tier}</span>
  );

  const ResearchBtn = ({ ticker }) => {
    const t = (ticker || "").toUpperCase();
    const mdx = mdxByTicker?.[t];
    const supabaseMemo = memoByTicker.get(t);
    if (mdx) {
      const label = (mdx.type === "thesis" || mdx.type === "pass") ? (mdx.type === "thesis" ? "Thesis" : "Pass") : "Memo";
      return (
        <a
          href={`/research/${mdx.slug}`}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.accent; e.currentTarget.style.color = COLORS.white; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.accent; }}
          style={{ padding: "4px 12px", borderRadius: 2, border: `0.5px solid ${COLORS.accent}`, background: "transparent", color: COLORS.accent, cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fontFamily: FONT, transition: "all 0.15s", textDecoration: "none", display: "inline-block" }}
        >{label}</a>
      );
    }
    if (supabaseMemo) {
      const label = supabaseMemo.type === "memo" ? "Memo" : "Thesis";
      return (
        <button
          onClick={() => onResearchClick(supabaseMemo.ticker)}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.accent; e.currentTarget.style.color = COLORS.white; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.accent; }}
          style={{ padding: "4px 12px", borderRadius: 2, border: `0.5px solid ${COLORS.accent}`, background: "transparent", color: COLORS.accent, cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fontFamily: FONT, transition: "all 0.15s" }}
        >{label}</button>
      );
    }
    return (
      <span style={{ padding: "4px 12px", border: `0.5px solid ${COLORS.gray300}`, background: "transparent", color: COLORS.gray400, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fontFamily: FONT, display: "inline-block", borderRadius: 2 }}>None</span>
    );
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COLORS.gray200}` }}>
            {["Position","Sector","Weight","Cost","Current","P/L %","Research", ...(isAdmin ? [""] : [])].map(h => (
              <th key={h} style={{ textAlign: h === "Weight" || h === "Cost" || h === "Current" || h === "P/L %" ? "right" : "left", padding: "10px 12px", color: COLORS.textSub, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map(h => {
            const mv = h.shares * h.currentPrice;
            const weight = totalValue > 0 ? (mv / totalValue) * 100 : 0;
            const pl = mv - (h.shares * h.costBasis);
            const plPct = h.costBasis > 0 ? (pl / (h.shares * h.costBasis)) * 100 : 0;
            const plColor = pl >= 0 ? COLORS.green : COLORS.red;
            return (
              <tr key={h.id} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                <td style={{ padding: "14px 12px", fontFamily: FONT }}>
                  <TierBadge tier={h.tier || 2} />
                  <span style={{ fontWeight: 700, color: COLORS.text }}>{h.ticker}</span>
                  {h.hedge && <span style={{ marginLeft: 8, fontSize: 11, fontStyle: "italic", color: COLORS.textSub }}>hedge</span>}
                </td>
                <td style={{ padding: "14px 12px", color: COLORS.textSub, fontSize: 13 }}>{h.sector}</td>
                <td style={{ padding: "14px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{weight.toFixed(0)}%</td>
                <td style={{ padding: "14px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(h.costBasis)}</td>
                <td style={{ padding: "14px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(h.currentPrice)}</td>
                <td style={{ padding: "14px 12px", textAlign: "right", color: plColor, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtPct(plPct)}</td>
                <td style={{ padding: "14px 12px" }}><ResearchBtn ticker={h.ticker} /></td>
                {isAdmin && (
                  <td style={{ padding: "14px 12px", whiteSpace: "nowrap" }}>
                    <button onClick={() => onEdit(h)} style={{ background: "none", border: "none", color: COLORS.textSub, cursor: "pointer", fontSize: 12, fontWeight: 600, marginRight: 8 }}>Edit</button>
                    <button onClick={() => onDelete(h.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
                  </td>
                )}
              </tr>
            );
          })}
          {!holdings.length && <tr><td colSpan={isAdmin ? 8 : 7} style={{ padding: 30, textAlign: "center", color: COLORS.textSub }}>No holdings yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
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
  const [editingHolding, setEditingHolding] = useState(null);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [chartRange, setChartRange] = useState("SI");
  const [memoTickerFilter, setMemoTickerFilter] = useState(null);
  const [mdxResearch, setMdxResearch] = useState([]);
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [editingMemo, setEditingMemo] = useState(null);
  const [memoSubTab, setMemoSubTab] = useState("all");
  const [memoSectorFilter, setMemoSectorFilter] = useState("all");
  const [showLogin, setShowLogin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [benchmarkRange, setBenchmarkRange] = useState("3mo");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("ticker");
    if (t) {
      setActiveTab(1);
      setMemoTickerFilter(t.toUpperCase());
    }
    if (params.get("tab") === "analysis") setActiveTab(1);
  }, []);

  // Keep URL in sync when active tab changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (activeTab === 1) u.searchParams.set("tab", "analysis");
    else u.searchParams.delete("tab");
    // Drop ticker filter from URL when leaving analysis tab
    if (activeTab !== 1) u.searchParams.delete("ticker");
    if (u.toString() !== window.location.href) {
      window.history.replaceState({}, "", u);
    }
  }, [activeTab]);

  useEffect(() => {
    fetch("/api/research-index")
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setMdxResearch(d.items || []))
      .catch(() => setMdxResearch([]));
  }, []);

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
          tier: h.tier || 2, hedge: !!h.hedge,
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

        setPortfolios({ "Slackline Fund": { accountValue: +pf.account_value, holdings, trades, inceptionDate: pf.inception_date || null, inceptionValue: pf.inception_value ? +pf.inception_value : null } });
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

  const liveHoldings = applyLiveQuotes(portfolio.holdings, quotes);
  const metrics = calcPortfolioMetrics(liveHoldings);
  const sectorData = getSectorData(liveHoldings);

  // Compute chart start date based on selected range
  const inception = portfolio.inceptionDate || null;
  const chartStart = (() => {
    const today = new Date();
    if (chartRange === "SI") return inception;
    if (chartRange === "1M") { const d = new Date(today); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0,10); }
    if (chartRange === "3M") { const d = new Date(today); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0,10); }
    if (chartRange === "YTD") return today.getFullYear() + "-01-01";
    return inception;
  })();

  const benchmarkData = useBenchmark(benchmarkRange, chartStart);
  const fundHistory = useFundHistory(liveHoldings, chartStart);

  // Build ticker → MDX research map (for holdings table Research button + analysis filtering)
  const mdxByTicker = mdxResearch.reduce((acc, r) => {
    if (r.ticker) acc[r.ticker.toUpperCase()] = r;
    return acc;
  }, {});

  const updatePortfolio = (key, updater) => setPortfolios(prev => ({ ...prev, [key]: updater(prev[key]) }));

  const addHolding = async (h) => {
    const { data } = await supabase.from("holdings").insert({
      portfolio_id: portfolioId, ticker: h.ticker, shares: h.shares,
      cost_basis: h.costBasis, current_price: h.currentPrice,
      sector: h.sector, pe_ratio: h.pe || null,
      tier: h.tier || 2, hedge: !!h.hedge,
    }).select().single();
    updatePortfolio(currentPortfolioKey, p => ({ ...p, holdings: [...p.holdings, { ...h, id: data.id }] }));
  };

  const updateHolding = async (id, h) => {
    await supabase.from("holdings").update({
      ticker: h.ticker, shares: h.shares,
      cost_basis: h.costBasis, current_price: h.currentPrice,
      sector: h.sector, pe_ratio: h.pe || null,
      tier: h.tier || 2, hedge: !!h.hedge,
    }).eq("id", id);
    updatePortfolio(currentPortfolioKey, p => ({ ...p, holdings: p.holdings.map(x => x.id === id ? { ...x, ...h } : x) }));
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

  const updateMemo = async (id, m) => {
    const { data } = await supabase.from("memos").update({
      ticker: m.ticker, title: m.title, thesis: m.thesis,
      status: m.status, type: m.type,
      subtype: m.subtype, sector: m.sector,
      pages: m.pages, read_minutes: m.read_minutes,
      position_label: m.position_label, featured: m.featured,
      metrics: m.metrics, pdf_url: m.pdf_url,
    }).eq("id", id).select().single();
    setMemos(prev => prev.map(x => x.id === id ? {
      ...x, ...m,
      pages: data?.pages ?? m.pages, read_minutes: data?.read_minutes ?? m.read_minutes,
    } : x));
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

        {/* PORTFOLIO TAB */}
        {activeTab === 0 && (() => {
          const totalValue = liveHoldings.reduce((s, h) => s + h.shares * h.currentPrice, 0);
          const tier1 = liveHoldings.filter(h => h.tier === 1);
          const tier1Value = tier1.reduce((s, h) => s + h.shares * h.currentPrice, 0);
          const tier1Weight = totalValue > 0 ? (tier1Value / totalValue) * 100 : 0;

          // since-inception fund return
          const fundIndexedNow = fundHistory?.series?.length
            ? fundHistory.series[fundHistory.series.length - 1].indexed
            : null;
          const sinceInceptionPct = fundIndexedNow != null ? fundIndexedNow - 100 : metrics.totalPLPct;
          // benchmark return for the same period
          const benchSeries = benchmarkData?.series || [];
          const benchPct = benchSeries.length
            ? (benchSeries[benchSeries.length - 1].pctReturn ?? 0)
            : 0;
          // research coverage
          const memoTickers = new Set(memos.map(m => m.ticker).filter(Boolean));
          const coveredCount = liveHoldings.filter(h => memoTickers.has(h.ticker)).length;
          const totalPositions = liveHoldings.length;

          const fundColor = sinceInceptionPct >= 0 ? COLORS.green : COLORS.red;
          const benchColor = benchPct >= 0 ? COLORS.green : COLORS.red;

          const inceptionLabel = inception
            ? new Date(inception).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "—";

          return (
            <div>
              {/* Title row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Portfolio · Q2 {new Date().getFullYear()}</div>
                  <h1 style={{ margin: 0, fontSize: 40, fontFamily: SERIF, fontWeight: 600, letterSpacing: -0.7, color: COLORS.text, lineHeight: 1.05 }}>Slackline Capital</h1>
                  <p style={{ margin: "6px 0 0", color: COLORS.textSub, fontSize: 14, fontStyle: "italic", fontFamily: SERIF }}>
                    Inception {inceptionLabel} · Active U.S. equity portfolio · USD
                  </p>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: COLORS.textSub, fontFamily: FONT }}>
                  {lastUpdated && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: quotesLoading ? COLORS.accent : COLORS.green }} />
                        <span>As of {lastUpdated.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} ET</span>
                      </div>
                      <button onClick={refetch} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 0 0", fontFamily: FONT }}>Refresh</button>
                    </>
                  )}
                </div>
              </div>

              {/* Four-stat strip */}
              <FourStatStrip stats={[
                { label: "Since inception", value: (sinceInceptionPct >= 0 ? "+" : "") + sinceInceptionPct.toFixed(2) + "%", subtitle: "Slackline Capital", color: fundColor },
                { label: "Benchmark", value: (benchPct >= 0 ? "+" : "") + benchPct.toFixed(2) + "%", subtitle: "S&P 500 (SPX)", color: benchColor },
                { label: "Active return", value: ((sinceInceptionPct - benchPct) >= 0 ? "+" : "") + ((sinceInceptionPct - benchPct) * 100).toFixed(0) + " bps", subtitle: "Alpha vs S&P", color: (sinceInceptionPct - benchPct) >= 0 ? COLORS.green : COLORS.red },
                { label: "Composition", value: totalPositions.toString(), subtitle: tier1.length + " core · top " + Math.round(tier1Weight) + "%" },
              ]} />

              {/* Performance chart */}
              <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 4, padding: "24px 28px", marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: COLORS.text }}>Performance vs benchmark</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, fontStyle: "italic", color: COLORS.textSub, fontFamily: SERIF }}>Indexed at 100 from inception. Time-weighted return.</p>
                  </div>
                  <div style={{ display: "flex", gap: 4, background: COLORS.gray100, borderRadius: 4, padding: 3 }}>
                    {["SI","1M","3M","YTD"].map(label => (
                      <button key={label} onClick={() => setChartRange(label)} style={{ padding: "5px 14px", borderRadius: 2, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: chartRange === label ? COLORS.white : "transparent", color: chartRange === label ? COLORS.text : COLORS.textSub, boxShadow: chartRange === label ? "0 1px 2px rgba(0,0,0,0.06)" : "none", letterSpacing: 0.5 }}>{label}</button>
                    ))}
                  </div>
                </div>
                <IndexedPerfChart fundSeries={fundHistory?.series} benchmarkSeries={benchmarkData?.series} inceptionDate={chartRange === "SI" ? inception : null} />
              </div>

              {/* Structure + Mandate */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <PortfolioStructure holdings={liveHoldings} />
                <InvestmentMandate />
              </div>

              {/* Holdings table */}
              <div style={{ background: COLORS.white, border: `1px solid ${COLORS.gray200}`, borderRadius: 4, padding: "24px 28px", marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: COLORS.text }}>Current holdings</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, fontStyle: "italic", color: COLORS.textSub, fontFamily: SERIF }}>Each position links to its documented research.</p>
                  </div>
                  {isAdmin && <button onClick={() => setShowAddHolding(true)} style={actionBtn}>+ Add position</button>}
                </div>
                <NewHoldingsTable
                  holdings={liveHoldings}
                  memos={memos}
                  mdxByTicker={mdxByTicker}
                  onEdit={(h) => setEditingHolding(h)}
                  onDelete={deleteHolding}
                  onResearchClick={(ticker) => {
                    setActiveTab(1);
                    setMemoTickerFilter(ticker);
                    if (typeof window !== "undefined") {
                      const u = new URL(window.location.href);
                      u.searchParams.set("ticker", ticker);
                      window.history.pushState({}, "", u);
                    }
                  }}
                  isAdmin={isAdmin}
                />
              </div>
            </div>
          );
        })()}

        {/* ANALYSIS TAB */}
        {activeTab === 1 && (() => {
          // Convert MDX research items to memo-like shape so they render in the same lists
          const mdxAsMemos = mdxResearch.map(r => ({
            id: "mdx:" + r.slug,
            slug: r.slug,
            isMdx: true,
            ticker: r.ticker,
            title: r.headline,
            thesis: r.kicker,
            date: r.published,
            status: "Active",
            type: r.type === "thesis" || r.type === "pass" ? r.type : "memo",
            sector: r.sector,
            featured: false, // MDX items aren't featured by frontmatter; legacy supabase only
            position_label: r.recommendation && r.ticker ? `${r.recommendation} $${r.ticker}` : (r.recommendation || null),
            subtype: null, pdf_url: null, pages: null, read_minutes: r.readTime || null, metrics: null,
          }));
          // Public viewers see MDX-takes-precedence (Supabase duplicates hidden).
          // Admin sees both, so legacy Supabase memos can still be edited/deleted.
          const mdxTickers = new Set(mdxAsMemos.map(m => (m.ticker || "").toUpperCase()).filter(Boolean));
          const supabaseList = isAdmin
            ? memos
            : memos.filter(m => !mdxTickers.has((m.ticker || "").toUpperCase()));
          const allMemos = [...mdxAsMemos, ...supabaseList];

          const featuredList = allMemos.filter(m => m.featured).slice(0, 2);
          const sectorsInUse = Array.from(new Set(allMemos.map(m => m.sector).filter(Boolean)));
          const sectorMatch = (m) => memoSectorFilter === "all" || m.sector === memoSectorFilter;
          const typeMatch = (m, t) => memoSubTab === "all" || memoSubTab === t;
          const tickerMatch = (m) => !memoTickerFilter || (m.ticker || "").toUpperCase() === memoTickerFilter;
          const memoList = allMemos.filter(m => (m.type || "thesis") === "memo" && sectorMatch(m) && typeMatch(m, "memo") && tickerMatch(m));
          const thesisList = allMemos.filter(m => (m.type || "thesis") === "thesis" && sectorMatch(m) && typeMatch(m, "thesis") && tickerMatch(m));
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

              {memoTickerFilter && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: COLORS.accentPale, border: `1px solid ${COLORS.accent}`, borderRadius: 4, marginBottom: 24, fontSize: 13 }}>
                  <span style={{ color: COLORS.accent, fontWeight: 600 }}>Filtering research by {memoTickerFilter}</span>
                  <button onClick={() => {
                    setMemoTickerFilter(null);
                    if (typeof window !== "undefined") {
                      const u = new URL(window.location.href);
                      u.searchParams.delete("ticker");
                      window.history.pushState({}, "", u);
                    }
                  }} style={{ marginLeft: "auto", background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 12, fontWeight: 700, textDecoration: "underline" }}>Clear</button>
                </div>
              )}

              {featuredList.length > 0 && !memoTickerFilter && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Featured</div>
                  {featuredList.map(m => (
                    <FeaturedCard key={m.id} memo={m} onDelete={deleteMemo} onEdit={(mm) => setEditingMemo(mm)} isAdmin={isAdmin} />
                  ))}
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
                  {memoList.map(m => <ResearchCard key={m.id} memo={m} onDelete={deleteMemo} onEdit={(mm) => setEditingMemo(mm)} isAdmin={isAdmin} />)}
                  {!memoList.length && <div style={{ color: COLORS.textSub, fontSize: 14, padding: "20px 4px" }}>No memos match this filter.</div>}
                </div>
              )}

              {showTheses && (
                <div style={{ marginBottom: 36 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${COLORS.gray200}`, paddingBottom: 8, marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: COLORS.text, fontSize: 22, fontFamily: SERIF, fontWeight: 600 }}>Position theses</h3>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent }}>{thesisList.length}</span>
                  </div>
                  {thesisList.map(m => <ResearchCard key={m.id} memo={m} onDelete={deleteMemo} onEdit={(mm) => setEditingMemo(mm)} isAdmin={isAdmin} />)}
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
      {editingHolding && <AddHoldingForm initial={editingHolding} onAdd={(h) => updateHolding(editingHolding.id, h)} onClose={() => setEditingHolding(null)} />}
      {showAddTrade && <AddTradeForm onAdd={addTrades} onClose={() => setShowAddTrade(false)} />}
      {showAddMemo && <AddMemoForm onAdd={addMemo} onClose={() => setShowAddMemo(false)} />}
      {editingMemo && <AddMemoForm initial={editingMemo} onAdd={(m) => updateMemo(editingMemo.id, m)} onClose={() => setEditingMemo(null)} />}
    </div>
  );
}
