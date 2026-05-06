// Returns daily fund value series given a list of holdings (ticker + shares)
// and an inception date. Each daily value is sum(shares_i * close_i).
// Tickers without prices for a given date are forward-filled.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tickers = (searchParams.get("tickers") || "").split(",").filter(Boolean);
  const sharesArr = (searchParams.get("shares") || "").split(",").map(Number);
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end"); // optional YYYY-MM-DD

  if (!tickers.length || tickers.length !== sharesArr.length || !start) {
    return Response.json({ error: "Missing tickers/shares/start" }, { status: 400 });
  }

  const period1 = Math.floor(new Date(start + "T00:00:00Z").getTime() / 1000);
  const period2 = end
    ? Math.floor(new Date(end + "T23:59:59Z").getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  try {
    const tickerSeries = {};
    await Promise.all(
      tickers.map(async (t) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?period1=${period1}&period2=${period2}&interval=1d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          next: { revalidate: 300 },
        });
        if (!res.ok) { tickerSeries[t] = null; return; }
        const data = await res.json();
        const r = data.chart?.result?.[0];
        if (!r) { tickerSeries[t] = null; return; }
        const ts = r.timestamp || [];
        const closes = r.indicators?.quote?.[0]?.close || [];
        const map = {};
        ts.forEach((t, i) => {
          if (closes[i] != null) {
            map[new Date(t * 1000).toISOString().slice(0, 10)] = closes[i];
          }
        });
        tickerSeries[t] = map;
      })
    );

    // collect all distinct dates (union)
    const allDates = new Set();
    Object.values(tickerSeries).forEach((m) => {
      if (m) Object.keys(m).forEach((d) => allDates.add(d));
    });
    const sortedDates = Array.from(allDates).sort();
    if (!sortedDates.length) {
      return Response.json({ error: "No price data" }, { status: 502 });
    }

    // forward-fill per ticker
    const lastClose = {};
    const series = sortedDates.map((d) => {
      let total = 0;
      tickers.forEach((t, i) => {
        const m = tickerSeries[t];
        if (m && m[d] != null) lastClose[t] = m[d];
        const c = lastClose[t];
        if (c != null) total += sharesArr[i] * c;
      });
      return { date: d, value: +total.toFixed(2) };
    }).filter((d) => d.value > 0);

    if (!series.length) {
      return Response.json({ error: "No usable data" }, { status: 502 });
    }

    const baseValue = series[0].value;
    const indexed = series.map((s) => ({
      date: s.date,
      value: s.value,
      indexed: +((s.value / baseValue) * 100).toFixed(4),
    }));

    return Response.json({
      tickers,
      start,
      series: indexed,
      baseValue,
      currentValue: series[series.length - 1].value,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
