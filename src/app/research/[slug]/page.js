import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getResearchBySlug, getResearchSlugs } from "@/lib/research";
import { mdxComponents } from "../mdx-components";

const BURGUNDY = "#8B1A1A";
const GOLD = "#C9A84C";
const GREEN = "#2D6E3A";
const GREY = "#6E6E6E";
const SUB = "#5C5750";
const CREAM = "#F4EFE6";
const NEAR_BLACK = "#1A1A1A";
const SERIF = "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif";
const SANS = "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export async function generateStaticParams() {
  return getResearchSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const item = getResearchBySlug(params.slug);
  if (!item) return { title: "Research not found" };
  const { headline, kicker } = item.frontmatter;
  return { title: `${headline} — Slackline Capital`, description: kicker };
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
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const cellHighlightColor = (h) => {
  if (h === "below") return GREEN;
  if (h === "above") return BURGUNDY;
  return NEAR_BLACK;
};

export default async function ResearchPage({ params }) {
  const item = getResearchBySlug(params.slug);
  if (!item) notFound();

  const { frontmatter: f, content } = item;
  const keyData = Array.isArray(f.keyData) ? f.keyData.slice(0, 7) : [];
  const typeLabel = (f.type || "memo").charAt(0).toUpperCase() + (f.type || "memo").slice(1);

  return (
    <div style={{ background: CREAM, minHeight: "100vh", fontFamily: SERIF, color: NEAR_BLACK }}>
      {/* Brand strip + minimal header */}
      <div style={{ background: BURGUNDY, height: 4 }} />
      <div style={{ borderBottom: "0.5px solid rgba(139,26,26,0.5)", padding: "0 40px", background: CREAM }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "baseline", justifyContent: "space-between", height: 64 }}>
          <Link href="/" style={{ fontFamily: SERIF, fontSize: 24, color: BURGUNDY, fontWeight: 700, letterSpacing: -0.4, textDecoration: "none" }}>
            Slackline <span style={{ fontSize: 12, color: SUB, fontStyle: "italic", fontWeight: 400 }}>Capital</span>
          </Link>
          <Link href="/?tab=analysis" style={{ fontFamily: SANS, fontSize: 11, color: BURGUNDY, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, textDecoration: "none" }}>← Back to Research</Link>
        </div>
      </div>

      {/* Content column */}
      <article style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: BURGUNDY, opacity: 0.85, marginBottom: 28 }}>
          Research / {typeLabel}{f.sector ? ` / ${f.sector}` : ""}
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 500, lineHeight: 1.15, letterSpacing: -0.6, color: NEAR_BLACK, margin: 0 }}>{f.headline}</h1>

        {/* Kicker */}
        {f.kicker && (
          <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 18, lineHeight: 1.45, color: SUB, margin: "14px 0 0" }}>{f.kicker}</p>
        )}

        {/* Burgundy rule */}
        <hr style={{ border: 0, borderTop: `0.5px solid ${BURGUNDY}`, margin: "24px 0 16px" }} />

        {/* Byline row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: SUB }}>
            Slackline Capital{f.published ? ` · Published ${fmtDate(f.published)}` : ""}{f.readTime ? ` · ${f.readTime} min read` : ""}
          </div>
          {f.recommendation && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "5px 12px", border: `0.5px solid ${BURGUNDY}`, borderRadius: 2, background: "#fff" }}>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: recColor(f.recommendation) }}>{f.recommendation}</span>
              {f.rationale && (
                <>
                  <span style={{ width: 1, height: 12, background: "rgba(139,26,26,0.3)" }} />
                  <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: SUB }}>{f.rationale}</span>
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

        {/* Body MDX */}
        <div className="research-body">
          <MDXRemote source={content} components={mdxComponents} />
        </div>

        {/* Footer */}
        <hr style={{ border: 0, borderTop: `0.5px solid ${BURGUNDY}`, margin: "56px 0 18px" }} />
        <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: SUB, lineHeight: 1.6, margin: "0 0 14px" }}>
          Slackline Capital research is published for portfolio transparency.{f.published ? ` Published ${fmtDate(f.published)}.` : ""}{f.dataAsOf ? ` Financial data as of ${fmtDate(f.dataAsOf)}.` : ""} Not investment advice.
        </p>
        <a href="#" style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: BURGUNDY, textTransform: "uppercase", letterSpacing: 1.2, textDecoration: "none", borderBottom: `0.5px solid ${BURGUNDY}`, paddingBottom: 1 }}>View as PDF</a>
      </article>
    </div>
  );
}
