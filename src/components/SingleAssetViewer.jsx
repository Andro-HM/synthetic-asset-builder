// src/components/SingleAssetViewer.jsx
import React, { useState } from 'react';
import { Loader, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import LiveSearch from './LiveSearch';
import ChartComponent from './ChartComponent';
import { fetchOHLCV } from '../utils/api';

export default function SingleAssetViewer() {
  const [selected, setSelected] = useState(null);
  const [ohlcv, setOhlcv] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSelect(item) {
    setSelected(item);
    setLoading(true);
    setError(null);
    setOhlcv([]);
    try {
      const data = await fetchOHLCV(item.ticker);
      if (data.length === 0) throw new Error('No historical data found for this instrument.');
      setOhlcv(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const lastBar = ohlcv.length > 0 ? ohlcv[ohlcv.length - 1] : null;
  const prevBar = ohlcv.length > 1 ? ohlcv[ohlcv.length - 2] : null;
  const change = lastBar && prevBar ? lastBar.close - prevBar.close : null;
  const changePct = change && prevBar ? (change / prevBar.close) * 100 : null;

  const isUp = change > 0;
  const isDown = change < 0;
  const priceColor = isUp ? '#26a69a' : isDown ? '#ef5350' : '#d1d4dc';

  return (
    <div className="flex flex-col gap-4 p-6" style={{ minHeight: 'calc(100vh - 52px)' }}>
      {/* Search Bar */}
      <div className="max-w-xl">
        <LiveSearch onSelect={handleSelect} placeholder="Search any stock, ETF, index e.g. AAPL, ^NSEI..." />
      </div>

      {/* Asset Header */}
      {selected && (
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <div className="text-2xl font-bold tracking-tight" style={{ color: '#d1d4dc' }}>
              {selected.ticker}
            </div>
            <div className="text-sm mt-0.5" style={{ color: '#787b86' }}>{selected.name}</div>
          </div>
          {lastBar && (
            <div className="flex items-end gap-3 pb-0.5">
              <span className="text-3xl font-bold" style={{ color: priceColor }}>
                {lastBar.close.toFixed(2)}
              </span>
              {change !== null && (
                <span className="flex items-center gap-1 text-sm font-medium pb-1" style={{ color: priceColor }}>
                  {isUp ? <TrendingUp size={14} /> : isDown ? <TrendingDown size={14} /> : <Minus size={14} />}
                  {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Loader size={22} className="animate-spin" style={{ color: '#26a69a' }} />
          <span style={{ color: '#787b86' }}>Fetching data for {selected?.ticker}…</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg border"
          style={{ background: '#ef535022', borderColor: '#ef535044' }}>
          <AlertCircle size={18} style={{ color: '#ef5350', flexShrink: 0, marginTop: 2 }} />
          <div style={{ color: '#ef5350' }}>
            <div className="font-semibold mb-1">Failed to load data</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {!loading && ohlcv.length > 0 && (
        <div className="flex-1">
          <ChartComponent candleData={ohlcv} height={540} />
          <div className="mt-2 text-xs" style={{ color: '#787b86' }}>
            {ohlcv.length} trading days • {ohlcv[0].time} – {ohlcv[ohlcv.length - 1].time}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selected && !loading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 opacity-40" style={{ minHeight: '300px' }}>
          <TrendingUp size={48} style={{ color: '#26a69a' }} />
          <p className="text-sm" style={{ color: '#787b86' }}>Search for any instrument to view its full price history</p>
        </div>
      )}
    </div>
  );
}
