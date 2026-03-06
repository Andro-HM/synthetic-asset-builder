// src/components/SyntheticBuilder.jsx
import React, { useState } from 'react';
import { Plus, Trash2, Loader, AlertCircle, GitMerge, Play } from 'lucide-react';
import LiveSearch from './LiveSearch';
import ChartComponent from './ChartComponent';
import { fetchOHLCV } from '../utils/api';
import {
  getIntersectionStart,
  buildDateUnion,
  forwardFillMissingData,
  computeLinearCombination
} from '../utils/math.js';

let nextId = 1;
function makeRow() {
  return { id: nextId++, ticker: null, name: null, weight: 1 };
}

export default function SyntheticBuilder() {
  const [rows, setRows] = useState([makeRow(), makeRow()]);
  const [syntheticData, setSyntheticData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState(null);
  const [formula, setFormula] = useState('');

  function addRow() {
    setRows(prev => [...prev, makeRow()]);
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function updateWeight(id, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, weight: value } : r));
  }

  function handleSelect(id, item) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ticker: item.ticker, name: item.name } : r));
    setErrors(prev => { const e = { ...prev }; delete e[id]; return e; });
  }

  function buildFormula(rows) {
    return rows
      .filter(r => r.ticker)
      .map(r => {
        const w = parseFloat(r.weight);
        const sign = w >= 0 ? (rows.indexOf(r) === 0 ? '' : ' + ') : ' − ';
        return `${sign}${Math.abs(w)} × ${r.ticker}`;
      })
      .join('');
  }

  async function handleCompute() {
    const validRows = rows.filter(r => r.ticker);

    if (validRows.length < 1) {
      setGlobalError('Add at least one asset with a valid ticker before computing.');
      return;
    }

    for (const r of validRows) {
      const w = parseFloat(r.weight);
      if (isNaN(w)) {
        setErrors(prev => ({ ...prev, [r.id]: 'Invalid weight' }));
        return;
      }
    }

    setLoading(true);
    setGlobalError(null);
    setSyntheticData([]);
    setErrors({});

    try {
      // 1. Fetch all OHLCV concurrently
      const results = await Promise.all(
        validRows.map(r => fetchOHLCV(r.ticker))
      );

      // 2. Find the intersection start date (the latest of all series' first dates)
      const intersectionStart = getIntersectionStart(results);
      if (!intersectionStart) throw new Error('Could not align datasets — one or more series may be empty.');

      // 3. Build full union of dates from the intersection start
      const allDates = buildDateUnion(results, intersectionStart);

      // 4. Forward-fill each dataset into the full date union
      const weights = validRows.map(r => parseFloat(r.weight));
      const aligned = results.map(series => forwardFillMissingData(series, allDates));

      // 5. Compute the linear combination
      const synthetic = computeLinearCombination(aligned, weights);

      setSyntheticData(synthetic);
      setFormula(buildFormula(validRows));
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const readyCount = rows.filter(r => r.ticker).length;

  return (
    <div className="flex flex-col gap-5 p-6" style={{ minHeight: 'calc(100vh - 52px)' }}>
      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#787b86' }}>
          Asset Combination
        </div>

        {/* Asset Rows */}
        <div className="flex flex-col gap-2">
          {rows.map((row, idx) => (
            <div key={row.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Weight */}
              <div className="flex items-center gap-1">
                <span className="text-sm" style={{ color: '#787b86' }}>×</span>
                <input
                  type="number"
                  value={row.weight}
                  onChange={e => updateWeight(row.id, e.target.value)}
                  step="0.1"
                  className="w-20 px-2 py-2 rounded border text-sm text-center"
                  style={{
                    background: '#131722',
                    borderColor: errors[row.id] ? '#ef5350' : '#2a2e39',
                    color: '#d1d4dc',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Search */}
              <div className="flex-1 min-w-48">
                {row.ticker ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded border"
                    style={{ background: '#131722', borderColor: '#26a69a33' }}>
                    <span className="font-semibold text-sm" style={{ color: '#26a69a' }}>{row.ticker}</span>
                    <span className="text-xs truncate" style={{ color: '#787b86' }}>{row.name}</span>
                    <button
                      onClick={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, ticker: null, name: null } : r))}
                      className="ml-auto text-xs"
                      style={{ color: '#787b86' }}
                    >✕</button>
                  </div>
                ) : (
                  <LiveSearch
                    onSelect={(item) => handleSelect(row.id, item)}
                    placeholder={`Asset ${idx + 1} — e.g. TCS.NS, AAPL…`}
                  />
                )}
              </div>

              {/* Remove */}
              {rows.length > 1 && (
                <button onClick={() => removeRow(row.id)}
                  className="p-2 rounded transition"
                  style={{ color: '#ef5350' }}
                  onMouseEnter={e => e.currentTarget.style.background='#ef535022'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium border transition"
            style={{ borderColor: '#2a2e39', color: '#787b86' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#26a69a'}
            onMouseLeave={e => e.currentTarget.style.borderColor='#2a2e39'}
          >
            <Plus size={14} /> Add Asset
          </button>

          <button
            onClick={handleCompute}
            disabled={loading || readyCount === 0}
            className="flex items-center gap-2 px-5 py-2 rounded text-sm font-semibold transition"
            style={{
              background: readyCount > 0 ? '#26a69a' : '#2a2e39',
              color: readyCount > 0 ? '#fff' : '#787b86',
              cursor: readyCount > 0 ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading
              ? <><Loader size={14} className="animate-spin" /> Computing…</>
              : <><Play size={14} /> Compute</>
            }
          </button>
        </div>
      </div>

      {/* Global Error */}
      {globalError && (
        <div className="flex items-start gap-3 p-4 rounded-lg border"
          style={{ background: '#ef535022', borderColor: '#ef535044' }}>
          <AlertCircle size={18} style={{ color: '#ef5350', flexShrink: 0, marginTop: 2 }} />
          <div style={{ color: '#ef5350' }}>
            <div className="font-semibold mb-1">Computation Error</div>
            <div className="text-sm">{globalError}</div>
          </div>
        </div>
      )}

      {/* Chart Result */}
      {!loading && syntheticData.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <GitMerge size={16} style={{ color: '#26a69a' }} />
            <span className="text-sm font-mono" style={{ color: '#d1d4dc' }}>{formula}</span>
          </div>
          <ChartComponent candleData={syntheticData} height={500} />
          <div className="mt-2 text-xs" style={{ color: '#787b86' }}>
            {syntheticData.length} aligned trading days • {syntheticData[0].time} – {syntheticData[syntheticData.length - 1].time}
          </div>
        </div>
      )}

      {/* Empty State */}
      {syntheticData.length === 0 && !loading && !globalError && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 opacity-40" style={{ minHeight: '260px' }}>
          <GitMerge size={48} style={{ color: '#26a69a' }} />
          <p className="text-sm" style={{ color: '#787b86' }}>Add assets, assign weights, and click Compute to build your synthetic</p>
        </div>
      )}
    </div>
  );
}
