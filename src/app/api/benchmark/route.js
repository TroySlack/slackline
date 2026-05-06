export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "3mo";
  const interval = searchParams.get("interval") || "1d";
  const start = searchParams.get("start"); // optional YYYY-MM-DD; if set, uses period1/period2

  try {
    let url;
    if (start) {
      // Pad period1 a few days back so we don't miss the inception trading day
      // due to UTC/exchange timezone offset; we'll strictly clip below.
      const startTs = new Date(start + "T00:00:00Z").getTime();
      const period1 = Math.floor((startTs - 3 * 24 * 60 * 60 * 1000) / 1000);
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

    // Build raw {date, close}; drop nulls
    const raw = timestamps.map((ts, i) => {
      const close = closes[i];
      if (close == null) return null;
      return {
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: +close.toFixed(2),
      };
    }).filter(Boolean);

    // If a start date was given, strictly clip to dates >= start so Yahoo's
    // prior-trading-day leakage doesn't pollute the index baseline.
    const clipped = start ? raw.filter((d) => d.date >= start) : raw;
    if (!clipped.length) {
      return Response.json({ error: "No data in requested range" }, { status: 502 });
    }

    const startPrice = clipped[0].close;
    const series = clipped.map((d) => ({
      date: d.date,
      close: d.close,
      pctReturn: +(((d.close - startPrice) / startPrice) * 100).toFixed(2),
      indexed: +((d.close / startPrice) * 100).toFixed(4),
    }));

    return Response.json({
      symbol: "^GSPC",
      name: "S&P 500",
      range: start ? "since" : range,
      interval,
      start: start || null,
      startPrice: +startPrice.toFixed(2),
      currentPrice: +series[series.length - 1].close.toFixed(2),
      series,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
