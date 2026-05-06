import fs from "fs";
import path from "path";
import matter from "gray-matter";

const RESEARCH_DIR = path.join(process.cwd(), "content", "research");

export function getResearchSlugs() {
  if (!fs.existsSync(RESEARCH_DIR)) return [];
  return fs
    .readdirSync(RESEARCH_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getResearchBySlug(slug) {
  const filePath = path.join(RESEARCH_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  return { slug, frontmatter: data, content };
}

// gray-matter parses unquoted YAML dates as JS Date objects. Coerce to ISO string.
const isoDate = (v) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

export function getAllResearch() {
  return getResearchSlugs()
    .map((slug) => getResearchBySlug(slug))
    .filter(Boolean)
    .sort((a, b) => {
      const ad = isoDate(a.frontmatter.published);
      const bd = isoDate(b.frontmatter.published);
      return bd.localeCompare(ad);
    });
}

// Public-safe summary for client consumption
export function summarize(item) {
  const { slug, frontmatter: f } = item;
  return {
    slug,
    headline: f.headline || "",
    kicker: f.kicker || "",
    ticker: f.ticker || "",
    sector: f.sector || "",
    type: f.type || "memo",
    recommendation: f.recommendation || "",
    rationale: f.rationale || "",
    published: isoDate(f.published),
    dataAsOf: isoDate(f.dataAsOf),
    readTime: f.readTime || 0,
  };
}
