export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "3mo";
  const interval = searchParams.get("interval") || "1d";
  const start = searchParams.get("start"); // optional YYYY-MM-DD; if set, uses period1/period2

  try {
    let url;
    if (start) {
      const period1 = Math.floor(new Date(start + "T00:00:00Z").getTime() / 1000);
      const period2 = Math.floor(Date.now() / 1000);
      url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${period1}&period2=${period2}&interval=${interval}`;
    } else {
      url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=${interval}&range=${range}`;
    }
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });

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

    const series = timestamps.map((ts, i) => {
      const close = closes[i];
      const date = new Date(ts * 1000).toISOString().slice(0, 10);
      const pctReturn = close && startPrice ? ((close - startPrice) / startPrice) * 100 : null;
      const indexed = close && startPrice ? (close / startPrice) * 100 : null;
      return {
        date,
        close: close ? +close.toFixed(2) : null,
        pctReturn: pctReturn !== null ? +pctReturn.toFixed(2) : null,
        indexed: indexed !== null ? +indexed.toFixed(4) : null,
      };
    }).filter((d) => d.close !== null);

    return Response.json({
      symbol: "^GSPC",
      name: "S&P 500",
      range: start ? "since" : range,
      interval,
      start: start || null,
      startPrice: +startPrice.toFixed(2),
      currentPrice: +(closes[closes.length - 1] || startPrice).toFixed(2),
      series,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
