// src/components/StatTests.jsx
// Page 4: Statistical Analysis Panel.
// Input: single asset OR multi-asset weighted combo (same row UI as SyntheticBuilder).
// Runs ADF, KPSS, Hurst, Half-Life, Engle-Granger (2 assets), Johansen (3+ assets).
// Tests run sequentially; each card is revealed as it completes.

import React, { useState } from 'react';
import { Plus, Trash2, Play, Loader, AlertCircle, CheckCircle, XCircle, FlaskConical, Minus } from 'lucide-react';
import LiveSearch from './LiveSearch';
import LineChart from './LineChart';
import { fetchOHLCV } from '../utils/api';
import {
  getIntersectionStart, buildDateUnion,
  forwardFillMissingData, computeLinearCombination,
} from '../utils/math.js';
import {
  runADF, runKPSS, combinedVerdict,
  runHurst, runHalfLife,
  runEngleGranger, runJohansen,
} from '../utils/stats.js';

// ─── Asset Row ───────────────────────────────────────────────────────────────
let nextId = 1;
function makeRow() { return { id: nextId++, ticker: null, name: null, weight: 1 }; }

function AssetRow({ row, idx, onSelect, onWeightChange, onRemove, canRemove }) {
  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
      <div className="flex items-center gap-1">
        <span className="text-sm" style={{ color: '#787b86' }}>×</span>
        <input
          type="number"
          value={row.weight}
          onChange={e => onWeightChange(row.id, e.target.value)}
          step="0.1"
          className="w-20 px-2 py-2 rounded border text-sm text-center"
          style={{ background: '#131722', borderColor: '#2a2e39', color: '#d1d4dc', outline: 'none' }}
        />
      </div>
      <div className="flex-1 min-w-48">
        {row.ticker ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded border"
            style={{ background: '#131722', borderColor: '#26a69a33' }}>
            <span className="font-semibold text-sm" style={{ color: '#26a69a' }}>{row.ticker}</span>
            <span className="text-xs truncate" style={{ color: '#787b86' }}>{row.name}</span>
            <button onClick={() => onSelect(row.id, null)} className="ml-auto text-xs" style={{ color: '#787b86' }}>✕</button>
          </div>
        ) : (
          <LiveSearch onSelect={item => onSelect(row.id, item)} placeholder={`Asset ${idx + 1}…`} />
        )}
      </div>
      {canRemove && (
        <button onClick={() => onRemove(row.id)} className="p-2 rounded transition"
          style={{ color: '#ef5350' }}
          onMouseEnter={e => e.currentTarget.style.background = '#ef535022'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function TestCard({ name, description, result, running }) {
  const isRunning = running;

  const isPositive = result?.verdict?.includes('MEAN-REVERTING') ||
    result?.verdict?.includes('STATIONARY') ||
    result?.verdict?.includes('COINTEGRATED') ||
    result?.verdict?.includes('RANDOM WALK') ||
    result?.verdict === 'STRONG_MR' ||
    result?.isCointegrated ||
    result?.isStationary ||
    result?.isValid;

  const verdictColor = result?.error ? '#ef5350'
    : isPositive ? '#26a69a'
    : '#ef5350';

  return (
    <div className="rounded-lg p-4 border flex flex-col gap-2"
      style={{ background: '#1e222d', borderColor: '#2a2e39', minHeight: '120px' }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm" style={{ color: '#d1d4dc' }}>{name}</div>
          <div className="text-xs" style={{ color: '#787b86' }}>{description}</div>
        </div>
        {isRunning && <Loader size={16} className="animate-spin" style={{ color: '#26a69a' }} />}
        {result && !result.error && (
          isPositive
            ? <CheckCircle size={18} style={{ color: '#26a69a' }} />
            : <XCircle size={18} style={{ color: '#ef5350' }} />
        )}
        {result?.error && <AlertCircle size={18} style={{ color: '#ef5350' }} />}
      </div>

      {result?.error && (
        <div className="text-xs" style={{ color: '#ef5350' }}>{result.error}</div>
      )}

      {result && !result.error && (
        <div className="mt-1 flex flex-col gap-1">
          {/* Stat value rows */}
          {result.stat !== undefined && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>Test stat</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>{result.stat}</span>
            </div>
          )}
          {result.pvalue !== undefined && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>p-value</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>≈ {result.pvalue}</span>
            </div>
          )}
          {result.lag !== undefined && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>Lag (AIC)</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>{result.lag}</span>
            </div>
          )}
          {result.H !== undefined && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>Hurst H</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>{result.H}</span>
            </div>
          )}
          {result.halfLife !== undefined && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>Half-life</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>
                {isFinite(result.halfLife) ? `${result.halfLife} days` : '∞'}
              </span>
            </div>
          )}
          {result.lambda !== undefined && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>λ (OU)</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>{result.lambda}</span>
            </div>
          )}
          {result.hedgeRatio !== undefined && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>Hedge ratio</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>{result.hedgeRatio}</span>
            </div>
          )}
          {result.numCointegrating !== undefined && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>Coint. vectors</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>{result.numCointegrating}</span>
            </div>
          )}
          {result.traceStats && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#787b86' }}>Trace stat</span>
              <span className="font-mono" style={{ color: '#d1d4dc' }}>{result.traceStats[0]}</span>
            </div>
          )}

          {/* Critical values */}
          {result.critValues && (
            <div className="text-xs mt-1" style={{ color: '#787b86' }}>
              CV: 1%={result.critValues.p01} &nbsp; 5%={result.critValues.p05} &nbsp; 10%={result.critValues.p10}
            </div>
          )}

          {/* Verdict badge */}
          <div className="mt-1 inline-flex items-center self-start px-2 py-0.5 rounded text-xs font-bold"
            style={{ background: `${verdictColor}22`, color: verdictColor }}>
            {result.verdict || result.label}
          </div>
        </div>
      )}

      {!result && !isRunning && (
        <div className="text-xs" style={{ color: '#2a2e39' }}>Waiting…</div>
      )}
    </div>
  );
}

// ─── Combined ADF+KPSS Verdict Banner ────────────────────────────────────────
function CombinedBanner({ adf, kpss }) {
  if (!adf || !kpss || adf.error || kpss.error) return null;
  const v = combinedVerdict(adf, kpss);
  const color = v === 'STRONG_MR' ? '#26a69a' : v === 'INCONCLUSIVE' ? '#f59e0b' : '#ef5350';
  const label = v === 'STRONG_MR' ? '✓ ADF + KPSS agree: STATIONARY (strong mean-reversion evidence)'
    : v === 'INCONCLUSIVE' ? '⚠ ADF & KPSS disagree — inconclusive stationarity'
    : '✗ Both tests indicate NON-STATIONARY series';
  return (
    <div className="col-span-full rounded-lg px-4 py-2 text-sm font-semibold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StatTests() {
  const [rows, setRows] = useState([makeRow()]);
  const [series, setSeries] = useState(null);          // { closes, lineData, formula, rawCloses[] }
  const [loadError, setLoadError] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  const [results, setResults] = useState({});
  const [runningTest, setRunningTest] = useState(null);
  const [testsDone, setTestsDone] = useState(false);

  // ── Row management ──────────────────────────────────────────────────────────
  function addRow() { setRows(p => [...p, makeRow()]); }
  function removeRow(id) { setRows(p => p.filter(r => r.id !== id)); }
  function updateWeight(id, val) { setRows(p => p.map(r => r.id === id ? { ...r, weight: val } : r)); }
  function handleSelect(id, item) {
    setRows(p => p.map(r => r.id === id ? { ...r, ticker: item?.ticker ?? null, name: item?.name ?? null } : r));
    setSeries(null); setResults({}); setTestsDone(false);
  }

  // ── Load Series ─────────────────────────────────────────────────────────────
  async function handleLoad() {
    const validRows = rows.filter(r => r.ticker);
    if (validRows.length === 0) return;
    setLoadingData(true); setLoadError(null); setSeries(null); setResults({}); setTestsDone(false);

    try {
      const rawDatasets = await Promise.all(validRows.map(r => fetchOHLCV(r.ticker)));

      // Align all series
      const start = getIntersectionStart(rawDatasets);
      if (!start) throw new Error('Could not find a common start date.');
      const allDates = buildDateUnion(rawDatasets, start);
      const aligned = rawDatasets.map(ds => forwardFillMissingData(ds, allDates));

      // Compute synthetic close (weighted) or plain close (single asset)
      const weights = validRows.map(r => parseFloat(r.weight) || 1);
      let closes;
      if (validRows.length === 1) {
        closes = aligned[0].map(p => p.close);
      } else {
        const synthetic = computeLinearCombination(aligned, weights);
        closes = synthetic.map(p => p.close);
      }

      // Build line chart data
      const lineData = allDates.map((time, i) => ({ time, value: closes[i] }));

      // Build formula string
      const formula = validRows.length === 1
        ? validRows[0].ticker
        : validRows.map((r, i) => `${parseFloat(r.weight) >= 0 && i > 0 ? '+' : ''}${r.weight}×${r.ticker}`).join(' ');

      // Preserve individual raw close arrays for EG/Johansen
      const rawCloses = aligned.map(ds => ds.map(p => p.close));

      setSeries({ closes, lineData, formula, rawCloses, numAssets: validRows.length });
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoadingData(false);
    }
  }

  // ── Run Tests (sequential, reveal one at a time) ───────────────────────────
  async function handleRunTests() {
    if (!series) return;
    setResults({}); setTestsDone(false);
    const { closes, rawCloses, numAssets } = series;

    const safe = async (name, fn) => {
      setRunningTest(name);
      await new Promise(r => setTimeout(r, 20)); // yield to React
      try {
        const r = await fn();
        setResults(p => ({ ...p, [name]: r }));
      } catch (e) {
        setResults(p => ({ ...p, [name]: { error: e.message, verdict: 'ERROR' } }));
      }
    };

    await safe('ADF',       () => runADF(closes));
    await safe('KPSS',      () => runKPSS(closes));
    await safe('Hurst',     () => runHurst(closes));
    await safe('HalfLife',  () => runHalfLife(closes));

    if (numAssets === 2) {
      await safe('EngleGranger', () => runEngleGranger(rawCloses[0], rawCloses[1]));
    }
    if (numAssets >= 2) {
      await safe('Johansen', () => runJohansen(rawCloses));
    }

    setRunningTest(null);
    setTestsDone(true);
  }

  const readyToLoad = rows.some(r => r.ticker);
  const readyToTest = !!series && !loadingData;
  const anyResults  = Object.keys(results).length > 0;
  const numAssets   = series?.numAssets ?? rows.filter(r => r.ticker).length;

  return (
    <div className="flex flex-col gap-5 p-6" style={{ minHeight: 'calc(100vh - 52px)' }}>

      {/* ── Input Section ── */}
      <div className="flex flex-col gap-3">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#787b86' }}>
          Series Definition
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((row, idx) => (
            <AssetRow key={row.id} row={row} idx={idx}
              onSelect={handleSelect} onWeightChange={updateWeight}
              onRemove={removeRow} canRemove={rows.length > 1} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addRow}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium border transition"
            style={{ borderColor: '#2a2e39', color: '#787b86' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#26a69a'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2e39'}>
            <Plus size={14} /> Add Asset
          </button>

          <button onClick={handleLoad} disabled={!readyToLoad || loadingData}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition"
            style={{
              background: readyToLoad ? '#2962ff' : '#2a2e39',
              color: readyToLoad ? '#fff' : '#787b86',
              opacity: loadingData ? 0.7 : 1,
              cursor: readyToLoad && !loadingData ? 'pointer' : 'not-allowed',
            }}>
            {loadingData ? <><Loader size={14} className="animate-spin" /> Loading…</> : 'Load Series'}
          </button>

          {series && (
            <button onClick={handleRunTests} disabled={!!runningTest}
              className="flex items-center gap-2 px-5 py-2 rounded text-sm font-semibold transition"
              style={{
                background: !runningTest ? '#26a69a' : '#2a2e39',
                color: !runningTest ? '#fff' : '#787b86',
                opacity: runningTest ? 0.7 : 1,
                cursor: !runningTest ? 'pointer' : 'not-allowed',
              }}>
              {runningTest
                ? <><Loader size={14} className="animate-spin" /> Running {runningTest}…</>
                : <><Play size={14} /> Run Tests</>}
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 p-4 rounded-lg border"
          style={{ background: '#ef535022', borderColor: '#ef535044' }}>
          <AlertCircle size={18} style={{ color: '#ef5350', flexShrink: 0 }} />
          <span className="text-sm" style={{ color: '#ef5350' }}>{loadError}</span>
        </div>
      )}

      {/* ── Line Chart ── */}
      {series && (
        <div>
          <div className="text-sm font-mono mb-2" style={{ color: '#d1d4dc' }}>
            {series.formula} &nbsp;
            <span className="text-xs" style={{ color: '#787b86' }}>
              — {series.closes.length} aligned trading days
            </span>
          </div>
          <LineChart data={series.lineData} height={240} color="#2962ff" />
        </div>
      )}

      {/* ── Results Grid ── */}
      {(anyResults || runningTest) && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#787b86' }}>
            Statistical Test Results
          </div>

          <div className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            <CombinedBanner adf={results.ADF} kpss={results.KPSS} />

            {[
              { key: 'ADF',          name: 'ADF Test',         desc: 'H₀: unit root (non-stationary). Reject → mean-reverting.' },
              { key: 'KPSS',         name: 'KPSS Test',        desc: 'H₀: stationary. Reject → non-stationary.' },
              { key: 'Hurst',        name: 'Hurst Exponent',   desc: 'H < 0.5: mean-reverting. H ≈ 0.5: random walk. H > 0.5: trending.' },
              { key: 'HalfLife',     name: 'Half-Life (OU)',   desc: 'Days for spread to revert 50% toward mean. 5–30 days = tradeable.' },
              ...(numAssets === 2 ? [{ key: 'EngleGranger', name: 'Engle-Granger', desc: 'OLS hedge ratio + ADF on residuals. Tests pairwise cointegration.' }] : []),
              ...(numAssets >= 2  ? [{ key: 'Johansen',     name: 'Johansen Test', desc: 'Reduced-rank VAR eigendecomposition. Finds # cointegrating vectors.' }] : []),
            ].map(({ key, name, desc }) => (
              <TestCard
                key={key}
                name={name}
                description={desc}
                result={results[key]}
                running={runningTest === key}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!series && !loadingData && !loadError && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 opacity-40" style={{ minHeight: '280px' }}>
          <FlaskConical size={48} style={{ color: '#26a69a' }} />
          <p className="text-sm" style={{ color: '#787b86' }}>
            Define a series above (single asset or weighted combo) and click Load Series
          </p>
        </div>
      )}
    </div>
  );
}
