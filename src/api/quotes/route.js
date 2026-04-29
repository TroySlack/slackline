// Next.js API Route: /api/quotes
// Fetches live stock quotes from Yahoo Finance's public endpoint
// This runs server-side on Vercel, avoiding CORS browser restrictions

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols");

  if (!symbols) {
    return Response.json({ error: "No symbols provided" }, { status: 400 });
  }

  const tickers = symbols.split(",").map((s) => s.trim().toUpperCase());

  try {
    const quotes = {};

    // Fetch each ticker from Yahoo Finance v8 API
    // In production finance, you would use Bloomberg or Refinitiv
    // For a personal project, Yahoo's public endpoint works well
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0",
              },
              next: { revalidate: 60 }, // cache for 60 seconds
            }
          );

          if (!res.ok) {
            quotes[ticker] = { error: "Failed to fetch" };
            return;
          }

          const data = await res.json();
          const result = data.chart?.result?.[0];

          if (!result) {
            quotes[ticker] = { error: "No data" };
            return;
          }

          const meta = result.meta;
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.chartPreviousClose || meta.previousClose;
          const change = currentPrice - previousClose;
          const changePct = previousClose > 0 ? (change / previousClose) * 100 : 0;

          quotes[ticker] = {
            price: currentPrice,
            previousClose,
            change: +change.toFixed(2),
            changePct: +changePct.toFixed(2),
            marketState: meta.currentTradingPeriod?.current?.timezone || "US/Eastern",
            timestamp: meta.regularMarketTime,
            currency: meta.currency || "USD",
          };
        } catch (err) {
          quotes[ticker] = { error: err.message };
        }
      })
    );

    return Response.json({ quotes, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
