// Next.js API Route: /api/benchmark
// Fetches historical S&P 500 data for the performance comparison chart
// Uses ^GSPC (S&P 500 index) from Yahoo Finance

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "3mo"; // 1mo, 3mo, 6mo, 1y, ytd
  const interval = searchParams.get("interval") || "1d";

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=${interval}&range=${range}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        next: { revalidate: 300 }, // cache for 5 minutes
      }
    );

    if (!res.ok) {
      return Response.json({ error: "Failed to fetch benchmark data" }, { status: 502 });
    }

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return Response.json({ error: "No benchmark data available" }, { status: 404 });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const startPrice = closes.find((c) => c !== null) || closes[0];

    // Build time series with percentage returns from start
    // This is a "rebased" chart - common in portfolio management
    // It normalizes everything to percentage change so you can compare
    // a $4000 portfolio against a trillion-dollar index on the same axis
    const series = timestamps.map((ts, i) => {
      const close = closes[i];
      const date = new Date(ts * 1000).toISOString().slice(0, 10);
      const pctReturn = close && startPrice ? ((close - startPrice) / startPrice) * 100 : null;
      return {
        date,
        close: close ? +close.toFixed(2) : null,
        pctReturn: pctReturn !== null ? +pctReturn.toFixed(2) : null,
      };
    }).filter((d) => d.close !== null);

    return Response.json({
      symbol: "^GSPC",
      name: "S&P 500",
      range,
      interval,
      startPrice: +startPrice.toFixed(2),
      currentPrice: +(closes[closes.length - 1] || startPrice).toFixed(2),
      series,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
