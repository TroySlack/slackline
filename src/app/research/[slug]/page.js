import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PdfPages from "./PdfPages.client";

const BURGUNDY = "#8B1A1A";
const GOLD = "#C9A84C";
const GREEN = "#2D6E3A";
const GREY = "#6E6E6E";
const SUB = "#5C5750";
const CREAM = "#F4EFE6";
const NEAR_BLACK = "#1A1A1A";
const SERIF = "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif";
const SANS = "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Server-side supabase client (public anon key, public read RLS)
function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

async function fetchMemoBySlug(slug) {
  try {
    const { data } = await supa().from("memos").select("*").eq("slug", slug).maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const memo = await fetchMemoBySlug(params.slug);
  if (!memo) return { title: "Research not found" };
  return { title: `${memo.title} — Slackline Capital`, description: memo.kicker || memo.thesis || "" };
}

const recColor = (rec) => {
  switch ((rec || "").toLowerCase()) {
    case "long": return GREEN;
    case "pass": return BURGUNDY;
    case "watchlist": return GOLD;
    case "monitor": return GREY;
    default: return SUB;
  }
};

const fmtDate = (s) => {
  if (!s) return "";
  const d = s instanceof Date ? s : new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const cellHighlightColor = (h) => {
  if (h === "below") return GREEN;
  if (h === "above") return BURGUNDY;
  return NEAR_BLACK;
};

export default async function ResearchPage({ params }) {
  const memo = await fetchMemoBySlug(params.slug);
  if (!memo) notFound();

  const keyData = Array.isArray(memo.metrics) ? memo.metrics.slice(0, 7) : [];
  const typeRaw = memo.type || "memo";
  const typeLabel = typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1);
  const recommendation = memo.recommendation || null;
  const rationale = memo.position_label && !recommendation ? memo.position_label : null;

  return (
    <div style={{ background: CREAM, minHeight: "100vh", fontFamily: SERIF, color: NEAR_BLACK }}>
      {/* Brand strip + header */}
      <div style={{ background: BURGUNDY, height: 4 }} />
      <div style={{ borderBottom: "0.5px solid rgba(139,26,26,0.5)", padding: "0 40px", background: CREAM }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "baseline", justifyContent: "space-between", height: 64 }}>
          <Link href="/" style={{ fontFamily: SERIF, fontSize: 24, color: BURGUNDY, fontWeight: 700, letterSpacing: -0.4, textDecoration: "none" }}>
            Slackline <span style={{ fontSize: 12, color: SUB, fontStyle: "italic", fontWeight: 400 }}>Capital</span>
          </Link>
          <Link href="/?tab=analysis" style={{ fontFamily: SANS, fontSize: 11, color: BURGUNDY, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, textDecoration: "none" }}>← Back to Research</Link>
        </div>
      </div>

      <article style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: BURGUNDY, opacity: 0.85, marginBottom: 28 }}>
          Research / {typeLabel}{memo.sector ? ` / ${memo.sector}` : ""}
        </div>

        <h1 style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 500, lineHeight: 1.15, letterSpacing: -0.6, color: NEAR_BLACK, margin: 0 }}>{memo.title}</h1>

        {memo.kicker && (
          <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 18, lineHeight: 1.45, color: SUB, margin: "14px 0 0" }}>{memo.kicker}</p>
        )}

        <hr style={{ border: 0, borderTop: `0.5px solid ${BURGUNDY}`, margin: "24px 0 16px" }} />

        {/* Byline */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: SUB }}>
            Slackline Capital{memo.date ? ` · Published ${fmtDate(memo.date)}` : ""}{memo.read_minutes ? ` · ${memo.read_minutes} min read` : ""}
          </div>
          {(recommendation || rationale) && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "5px 12px", border: `0.5px solid ${BURGUNDY}`, borderRadius: 2, background: "#fff" }}>
              {recommendation && (
                <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: recColor(recommendation) }}>{recommendation}</span>
              )}
              {rationale && (
                <>
                  {recommendation && <span style={{ width: 1, height: 12, background: "rgba(139,26,26,0.3)" }} />}
                  <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: SUB }}>{rationale}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Key data card */}
        {keyData.length > 0 && (
          <div style={{ display: "flex", border: `0.5px solid ${BURGUNDY}`, borderRadius: 2, background: "#fff", marginBottom: 36, overflow: "hidden" }}>
            {keyData.map((cell, i) => (
              <div key={i} style={{ flex: 1, padding: "14px 16px", borderRight: i === keyData.length - 1 ? "none" : "0.5px solid rgba(139,26,26,0.25)" }}>
                <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: SUB, marginBottom: 6 }}>{cell.label}</div>
                <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: cellHighlightColor(cell.highlight), fontVariantNumeric: "tabular-nums" }}>{cell.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* PDF rendered as inline page images (PDF.js) */}
        {memo.pdf_url ? (
          <div style={{ marginBottom: 36 }}>
            <PdfPages url={memo.pdf_url} maxWidth={680} />
          </div>
        ) : (
          <div style={{ border: "0.5px dashed rgba(139,26,26,0.4)", padding: 40, textAlign: "center", color: SUB, fontStyle: "italic", fontSize: 14, marginBottom: 36 }}>
            No memo document attached.
          </div>
        )}

        {/* Footer */}
        <hr style={{ border: 0, borderTop: `0.5px solid ${BURGUNDY}`, margin: "20px 0 18px" }} />
        <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: SUB, lineHeight: 1.6, margin: "0 0 14px" }}>
          Slackline Capital research is published for portfolio transparency.{memo.date ? ` Published ${fmtDate(memo.date)}.` : ""}{memo.data_as_of ? ` Financial data as of ${fmtDate(memo.data_as_of)}.` : ""} Not investment advice.
        </p>
        {memo.pdf_url && (
          <a href={memo.pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: BURGUNDY, textTransform: "uppercase", letterSpacing: 1.2, textDecoration: "none", borderBottom: `0.5px solid ${BURGUNDY}`, paddingBottom: 1 }}>View as PDF</a>
        )}
      </article>
    </div>
  );
}
