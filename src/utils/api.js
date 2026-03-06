// src/utils/api.js
// Calls go through Vite's dev server proxy (/yahoo-search, /yahoo-chart)
// which strips CORS restrictions. No external proxy services needed.

/**
 * Searches Yahoo Finance for instruments matching `query`.
 * @param {string} query
 * @returns {Promise<Array<{ticker: string, name: string}>>}
 */
export async function searchInstruments(query) {
  if (!query || query.trim() === '') return [];

  const params = new URLSearchParams({
    q: query,
    lang: 'en-US',
    region: 'IN',
    quotesCount: '10',
  });

  const response = await fetch(`/yahoo-search?${params.toString()}`);
  if (!response.ok) throw new Error(`Search request failed: HTTP ${response.status}`);

  const data = await response.json();

  if (data?.quotes) {
    return data.quotes
      .filter(q => q.symbol)
      .map(q => ({
        ticker: q.symbol,
        name: q.shortname || q.longname || q.symbol,
      }));
  }
  return [];
}

/**
 * Fetches full max available daily OHLCV from Yahoo Finance.
 * Dates are returned as YYYY-MM-DD UTC strings to prevent timezone shift in Lightweight Charts.
 * @param {string} ticker
 * @returns {Promise<Array<{time: string, open: number, high: number, low: number, close: number, volume: number}>>}
 */
export async function fetchOHLCV(ticker) {
  // Use period1=0 (epoch start) + period2=now rather than range=max.
  // Yahoo Finance silently overrides interval=1d → monthly when range=max is
  // used on long-history series (e.g. ^NSEI, ^DJI). Explicit period timestamps
  // force it to honour the daily interval for the full available history.
  const period2 = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({ interval: '1d', period1: '0', period2: String(period2) });
  const response = await fetch(`/yahoo-chart/${encodeURIComponent(ticker)}?${params.toString()}`);

  if (!response.ok) throw new Error(`Chart request failed for "${ticker}": HTTP ${response.status}`);

  const data = await response.json();

  const result = data?.chart?.result?.[0];
  if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
    throw new Error(`No OHLCV data found for "${ticker}". It may be an invalid ticker.`);
  }

  const timestamps = result.timestamp;
  const { open, high, low, close, volume } = result.indicators.quote[0];

  const formattedData = [];
  for (let i = 0; i < timestamps.length; i++) {
    // Skip bars with null price data (common in Yahoo's raw response)
    if (open[i] == null || high[i] == null || low[i] == null || close[i] == null) continue;

    // Parse UNIX seconds → UTC YYYY-MM-DD string
    const d = new Date(timestamps[i] * 1000);
    const time = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    formattedData.push({
      time,
      open: open[i],
      high: high[i],
      low: low[i],
      close: close[i],
      volume: volume[i] ?? 0,
    });
  }

  if (formattedData.length === 0) {
    throw new Error(`Data returned for "${ticker}" contained no valid price bars.`);
  }

  // Deduplicate by date (keep last occurrence — Yahoo sometimes emits the same
  // trading day twice when a split/dividend adjustment is present) then sort
  // ascending. Lightweight Charts skips bars that are out-of-order or duplicated,
  // causing the "weekly/monthly candle" visual artefact.
  const dateMap = new Map();
  for (const bar of formattedData) dateMap.set(bar.time, bar);
  const cleaned = Array.from(dateMap.values()).sort((a, b) => (a.time < b.time ? -1 : 1));

  // DEBUG: log first 10 bars so we can verify date strings in the console
  console.log(`[fetchOHLCV] ${ticker} — first 10 bars:`, cleaned.slice(0, 10).map(b => b.time));

  return cleaned;
}
