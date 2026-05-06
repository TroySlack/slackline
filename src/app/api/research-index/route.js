import { getAllResearch, summarize } from "@/lib/research";

export async function GET() {
  try {
    const all = getAllResearch().map(summarize);
    return Response.json({ items: all });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
