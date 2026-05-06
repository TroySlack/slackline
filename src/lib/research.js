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

export function getAllResearch() {
  return getResearchSlugs()
    .map((slug) => getResearchBySlug(slug))
    .filter(Boolean)
    .sort((a, b) => {
      const ad = a.frontmatter.published || "";
      const bd = b.frontmatter.published || "";
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
    published: f.published || "",
    dataAsOf: f.dataAsOf || "",
    readTime: f.readTime || 0,
  };
}
