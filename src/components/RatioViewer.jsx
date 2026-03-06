// src/components/RatioViewer.jsx
import React, { useState } from 'react';
import { Loader, AlertCircle, Divide, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import LiveSearch from './LiveSearch';
import ChartComponent from './ChartComponent';
import { fetchOHLCV } from '../utils/api';
import {
  getIntersectionStart,
  buildDateUnion,
  forwardFillMissingData,
  computeRatio,
} from '../utils/math.js';

export default function RatioViewer() {
  const [assetA, setAssetA] = useState(null);
  const [assetB, setAssetB] = useState(null);
  const [ratioData, setRatioData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [label, setLabel] = useState('');

  async function handleCompute() {
    if (!assetA || !assetB) return;

    setLoading(true);
    setError(null);
    setRatioData([]);

    try {
      // 1. Fetch both concurrently
      const [dataA, dataB] = await Promise.all([
        fetchOHLCV(assetA.ticker),
        fetchOHLCV(assetB.ticker),
      ]);

      // 2. Align: intersection start → union of dates → forward-fill each
      const intersectionStart = getIntersectionStart([dataA, dataB]);
      if (!intersectionStart) throw new Error('Could not find overlapping date range between the two assets.');

      const allDates = buildDateUnion([dataA, dataB], intersectionStart);
      const alignedA = forwardFillMissingData(dataA, allDates);
      const alignedB = forwardFillMissingData(dataB, allDates);

      // 3. Compute ratio
      const ratio = computeRatio(alignedA, alignedB);
      if (ratio.length === 0) throw new Error('Ratio computation produced no valid bars (possible zero prices in denominator asset).');

      setRatioData(ratio);
      setLabel(`${assetA.ticker} / ${assetB.ticker}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const lastBar  = ratioData.length > 0 ? ratioData[ratioData.length - 1] : null;
  const prevBar  = ratioData.length > 1 ? ratioData[ratioData.length - 2] : null;
  const change   = lastBar && prevBar ? lastBar.close - prevBar.close : null;
  const changePct = change != null && prevBar ? (change / prevBar.close) * 100 : null;
  const isUp    = change > 0;
  const isDown  = change < 0;
  const priceColor = isUp ? '#26a69a' : isDown ? '#ef5350' : '#d1d4dc';

  const canCompute = assetA && assetB;

  return (
    <div className="flex flex-col gap-5 p-6" style={{ minHeight: 'calc(100vh - 52px)' }}>

      {/* Two search bars */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        {/* Asset A */}
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#787b86' }}>Asset A (numerator)</span>
          {assetA ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded border"
              style={{ background: '#131722', borderColor: '#26a69a44' }}>
              <span className="font-semibold text-sm" style={{ color: '#26a69a' }}>{assetA.ticker}</span>
              <span className="text-xs truncate" style={{ color: '#787b86' }}>{assetA.name}</span>
              <button onClick={() => { setAssetA(null); setRatioData([]); }} className="ml-auto text-xs" style={{ color: '#787b86' }}>✕</button>
            </div>
          ) : (
            <LiveSearch onSelect={(item) => { setAssetA(item); setRatioData([]); }} placeholder="Search Asset A…" />
          )}
        </div>

        {/* Divider symbol */}
        <div className="flex items-center justify-center pt-6 px-1">
          <Divide size={20} style={{ color: '#787b86' }} />
        </div>

        {/* Asset B */}
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#787b86' }}>Asset B (denominator)</span>
          {assetB ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded border"
              style={{ background: '#131722', borderColor: '#26a69a44' }}>
              <span className="font-semibold text-sm" style={{ color: '#26a69a' }}>{assetB.ticker}</span>
              <span className="text-xs truncate" style={{ color: '#787b86' }}>{assetB.name}</span>
              <button onClick={() => { setAssetB(null); setRatioData([]); }} className="ml-auto text-xs" style={{ color: '#787b86' }}>✕</button>
            </div>
          ) : (
            <LiveSearch onSelect={(item) => { setAssetB(item); setRatioData([]); }} placeholder="Search Asset B…" />
          )}
        </div>

        {/* Compute button */}
        <div className="flex items-end pb-0.5 pt-6">
          <button
            onClick={handleCompute}
            disabled={!canCompute || loading}
            className="flex items-center gap-2 px-5 py-2 rounded text-sm font-semibold transition whitespace-nowrap"
            style={{
              background: canCompute ? '#26a69a' : '#2a2e39',
              color: canCompute ? '#fff' : '#787b86',
              cursor: canCompute && !loading ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <><Loader size={14} className="animate-spin" /> Computing…</>
              : 'Compute Ratio'
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg border"
          style={{ background: '#ef535022', borderColor: '#ef535044' }}>
          <AlertCircle size={18} style={{ color: '#ef5350', flexShrink: 0, marginTop: 2 }} />
          <div style={{ color: '#ef5350' }}>
            <div className="font-semibold mb-1">Error</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* Result header + chart */}
      {!loading && ratioData.length > 0 && (
        <div>
          {/* Title row */}
          <div className="flex items-end gap-4 flex-wrap mb-3">
            <div>
              <div className="text-xl font-bold font-mono tracking-tight" style={{ color: '#d1d4dc' }}>{label}</div>
              <div className="text-xs mt-0.5" style={{ color: '#787b86' }}>
                {ratioData.length} aligned trading days • {ratioData[0].time} – {ratioData[ratioData.length - 1].time}
              </div>
            </div>
            {lastBar && (
              <div className="flex items-end gap-2 pb-0.5">
                <span className="text-3xl font-bold" style={{ color: priceColor }}>
                  {lastBar.close.toFixed(4)}
                </span>
                {change != null && (
                  <span className="flex items-center gap-1 text-sm font-medium pb-1" style={{ color: priceColor }}>
                    {isUp ? <TrendingUp size={14}/> : isDown ? <TrendingDown size={14}/> : <Minus size={14}/>}
                    {change >= 0 ? '+' : ''}{change.toFixed(4)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
          </div>

          <ChartComponent candleData={ratioData} height={500} />
        </div>
      )}

      {/* Empty state */}
      {!loading && ratioData.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 opacity-40" style={{ minHeight: '280px' }}>
          <Divide size={48} style={{ color: '#26a69a' }} />
          <p className="text-sm" style={{ color: '#787b86' }}>Select two assets and click Compute Ratio to see A ÷ B as a candlestick</p>
        </div>
      )}
    </div>
  );
}
