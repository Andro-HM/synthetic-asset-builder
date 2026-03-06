// src/components/ChartComponent.jsx
// Indicator system + chart enhancements.
// Architecture: Effect 1 creates the bare chart (once). Effect 2 owns ALL series
// — price series AND indicator series — so they are always in sync.

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  CandlestickSeries, LineSeries, AreaSeries, HistogramSeries,
} from 'lightweight-charts';
import { Eye, EyeOff, Settings, Plus, Trash2, ChevronDown, X } from 'lucide-react';
import { useIndicators } from '../hooks/useIndicators.js';
import { calcMA, calcVWAP, calcRSI, calcMACD, calcVolume } from '../utils/indicators.js';

const MA_TYPES = ['SMA','EMA','RMA','SMMA','WMA','VWMA','DEMA','TEMA','TRIMA',
  'T3','ALMA','KAMA','FRAMA','LSMA','HMA','EHMA','THMA','ZLMA','SWMA','McGinley','VAMA'];
const SOURCES = ['close','open','high','low','hlc3','ohlc4'];

// ─── Indicator Modal ──────────────────────────────────────────────────────────
function IndicatorModal({ onAdd, onClose }) {
  const groups = [
    { label: 'Overlay',        items: [{ type: 'MA', label: 'Moving Average (21 types)' }, { type: 'VWAP', label: 'VWAP (cumulative)' }] },
    { label: 'Separate Pane', items: [{ type: 'Volume', label: 'Volume' }, { type: 'RSI', label: 'RSI' }, { type: 'MACD', label: 'MACD' }] },
  ];
  return (
    <div className="absolute top-full left-0 mt-1 z-30 rounded-lg border shadow-xl min-w-56"
      style={{ background: '#1e222d', borderColor: '#2a2e39' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#2a2e39' }}>
        <span className="text-xs font-semibold" style={{ color: '#d1d4dc' }}>Add Indicator</span>
        <button onClick={onClose} style={{ color: '#787b86' }}><X size={13}/></button>
      </div>
      {groups.map(g => (
        <div key={g.label} className="px-2 py-1">
          <div className="text-xs px-1 py-1 font-semibold uppercase tracking-widest" style={{ color: '#4c5260' }}>{g.label}</div>
          {g.items.map(item => (
            <button key={item.type} onClick={() => { onAdd(item.type); onClose(); }}
              className="w-full text-left px-2 py-1.5 rounded text-sm transition"
              style={{ color: '#d1d4dc' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2e39'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function IndicatorSettings({ ind, onUpdate, onClose }) {
  const s = ind.settings;
  const num  = (label, key, extra = {}) => (
    <label key={key} className="flex items-center justify-between gap-2 text-xs">
      <span style={{ color: '#787b86' }}>{label}</span>
      <input type="number" value={s[key] ?? ''} onChange={e => onUpdate({ [key]: +e.target.value })}
        className="w-20 px-2 py-1 rounded border text-xs text-right"
        style={{ background: '#131722', borderColor: '#2a2e39', color: '#d1d4dc', outline: 'none' }} {...extra}/>
    </label>
  );
  const col  = (label, key) => (
    <label key={key} className="flex items-center justify-between gap-2 text-xs">
      <span style={{ color: '#787b86' }}>{label}</span>
      <input type="color" value={s[key] ?? '#ffffff'} onChange={e => onUpdate({ [key]: e.target.value })}
        className="w-8 h-6 rounded cursor-pointer" style={{ background: 'none', border: 'none' }}/>
    </label>
  );
  const sel  = (label, key, opts) => (
    <label key={key} className="flex items-center justify-between gap-2 text-xs">
      <span style={{ color: '#787b86' }}>{label}</span>
      <select value={s[key] ?? opts[0]} onChange={e => onUpdate({ [key]: e.target.value })}
        className="px-2 py-1 rounded border text-xs"
        style={{ background: '#131722', borderColor: '#2a2e39', color: '#d1d4dc', outline: 'none' }}>
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
  return (
    <div className="absolute top-full left-0 mt-1 z-30 rounded-lg border shadow-xl p-3 min-w-52"
      style={{ background: '#1e222d', borderColor: '#2a2e39' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: '#d1d4dc' }}>{ind.type} Settings</span>
        <button onClick={onClose} style={{ color: '#787b86' }}><X size={13}/></button>
      </div>
      <div className="flex flex-col gap-2">
        {ind.type === 'MA' && <>
          {sel('Type', 'type', MA_TYPES)}
          {num('Period', 'period', { min: 2, max: 500 })}
          {sel('Source', 'source', SOURCES)}
          {col('Color', 'color')}
          {num('Thickness', 'thickness', { min: 1, max: 4, step: 0.5 })}
          {s.type === 'ALMA' && <>{num('Offset', 'offset', { min: 0, max: 1, step: 0.05 })}{num('Sigma', 'sigma', { min: 1, max: 20 })}</>}
          {s.type === 'T3'   && num('Volume Factor', 'vf', { min: 0, max: 1, step: 0.1 })}
        </>}
        {ind.type === 'VWAP' && <>{col('Color', 'color')}{num('Thickness', 'thickness', { min: 1, max: 4, step: 0.5 })}</>}
        {ind.type === 'Volume' && <>{col('Up Color', 'upColor')}{col('Down Color', 'downColor')}</>}
        {ind.type === 'RSI' && <>
          {num('Period', 'period', { min: 2, max: 200 })}
          {sel('Source', 'source', SOURCES)}
          {col('Line Color', 'color')}
          {num('Overbought', 'obLevel', { min: 50, max: 100 })}
          {num('Oversold', 'osLevel', { min: 0, max: 50 })}
        </>}
        {ind.type === 'MACD' && <>
          {num('Fast', 'fast', { min: 2, max: 100 })}
          {num('Slow', 'slow', { min: 2, max: 200 })}
          {num('Signal', 'signal', { min: 2, max: 50 })}
          {col('MACD Color', 'color')}
          {col('Signal Color', 'signalColor')}
        </>}
      </div>
    </div>
  );
}

// ─── Indicator Badge ──────────────────────────────────────────────────────────
function IndicatorBadge({ ind, value, onToggle, onRemove, onSettingsToggle }) {
  const label = ind.type === 'MA'
    ? `${ind.settings.type}(${ind.settings.period})`
    : ind.type === 'RSI'  ? `RSI(${ind.settings.period})`
    : ind.type === 'MACD' ? `MACD(${ind.settings.fast},${ind.settings.slow})`
    : ind.type;
  const c = ind.settings.color ?? '#d1d4dc';
  return (
    <div className="flex items-center gap-1 text-xs rounded px-1.5 py-0.5"
      style={{ background: '#1e222d99', border: '1px solid #2a2e3966' }}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }}/>
      <span style={{ color: '#d1d4dc' }}>{label}</span>
      {value != null && <span className="font-mono" style={{ color: c }}>{(+value).toFixed(2)}</span>}
      <button onClick={onToggle} className="ml-1" style={{ color: '#787b86' }}>
        {ind.visible ? <Eye size={11}/> : <EyeOff size={11}/>}
      </button>
      <button onClick={onSettingsToggle} style={{ color: '#787b86' }}><Settings size={11}/></button>
      <button onClick={onRemove}         style={{ color: '#787b86' }}><Trash2 size={11}/></button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChartComponent({ candleData, height = 460 }) {
  const containerRef  = useRef(null);
  const chartRef      = useRef(null);   // bare chart, created once
  const barMapRef     = useRef(new Map());
  const syncMapRef    = useRef(new Map()); // id → { series[], paneRef }
  const visibleRangeRef = useRef(null);    // persists zoom/scroll across rebuilds

  const [crosshair, setCrosshair]     = useState(null);
  const [chartType, setChartType]     = useState('candle');
  const [modalOpen, setModalOpen]     = useState(false);
  const [openSettings, setOpenSettings] = useState(null);
  const [badgeValues, setBadgeValues] = useState({});

  const { indicators, addIndicator, removeIndicator, updateSettings, toggleVisibility } = useIndicators();

  // ── barMap ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = new Map();
    for (const b of candleData ?? []) m.set(b.time, b);
    barMapRef.current = m;
  }, [candleData]);

  // ── Effect 1: Create bare chart (once) ─────────────────────────────────────
  // Does NOT create any series — that is Effect 2's job.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#131722' }, textColor: '#787b86' },
      grid:   { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2e39' },
      timeScale: { borderColor: '#2a2e39' },
      width:  containerRef.current.clientWidth,
      height: height,
    });

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.point) { setCrosshair(null); return; }
      const bar = barMapRef.current.get(param.time);
      if (bar) setCrosshair({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
      else setCrosshair(null);
    });

    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    chartRef.current = chart;

    return () => {
      window.removeEventListener('resize', onResize);
      // Mark disposed BEFORE calling chart.remove() so Effect 2 can bail out
      chartRef.current = null;
      syncMapRef.current.clear();
      chart.remove();
    };
  // height intentionally excluded — Effect 2 manages applyOptions({height})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effect 2: ALL series — price + indicators (single combined effect) ──────
  // This is the ONLY place series are added to the chart. By keeping price series
  // and indicator series in the same effect we eliminate the cleanup race where
  // a prior effect's cleanup could destroy the chart mid-sync.
  useEffect(() => {
    const chart = chartRef.current;
    // Bail out if chart was disposed or data not available
    if (!chart || !candleData?.length) return;

    // Save current visible range BEFORE teardown so we can restore zoom/scroll after rebuild
    try { visibleRangeRef.current = chart.timeScale().getVisibleRange(); } catch {}

    // ── Teardown: remove ALL existing series and panes ──────────────────────
    // (includes the price series from the previous run)
    for (const refs of syncMapRef.current.values()) {
      for (const s of refs.series) { try { chart.removeSeries(s); } catch {} }
      if (refs.paneRef)            { try { chart.removePane(refs.paneRef); } catch {} }
    }
    syncMapRef.current.clear();

    // Re-check after teardown — chart.removePane could theoretically trigger something
    if (!chartRef.current) return;

    // ── Update chart height ──────────────────────────────────────────────────
    const numPaneInds = indicators.filter(i => i.isPane).length;
    chart.applyOptions({ height: height + Math.min(numPaneInds, 2) * 120 });

    // ── Price series (always pane 0, always first) ───────────────────────────
    let priceSeries;
    if (chartType === 'candle') {
      priceSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a', downColor: '#ef5350',
        borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
      }, 0);
      priceSeries.setData(candleData);
    } else if (chartType === 'line') {
      priceSeries = chart.addSeries(LineSeries, { color: '#2962ff', lineWidth: 1.5, priceLineVisible: false }, 0);
      priceSeries.setData(candleData.map(b => ({ time: b.time, value: b.close })));
    } else {
      priceSeries = chart.addSeries(AreaSeries, {
        lineColor: '#2962ff', topColor: '#2962ff44', bottomColor: '#2962ff00',
        lineWidth: 1.5, priceLineVisible: false,
      }, 0);
      priceSeries.setData(candleData.map(b => ({ time: b.time, value: b.close })));
    }
    // Store price series under a reserved key so teardown can remove it next run
    syncMapRef.current.set('__price__', { series: [priceSeries], paneRef: null });

    // ── Indicator series ─────────────────────────────────────────────────────
    const newBadgeValues = {};
    for (const ind of indicators) {
      if (!chartRef.current) break; // bail if chart was disposed mid-loop
      const { id, type, settings, visible, isPane } = ind;

      let paneRef = null;
      let paneIdx = 0;
      if (isPane) {
        try { paneRef = chart.addPane(); } catch { continue; }
        paneIdx = chart.panes().indexOf(paneRef);
      }

      const series = [];
      try {
        if (type === 'MA') {
          series.push(chart.addSeries(LineSeries, {
            color: settings.color, lineWidth: settings.thickness,
            priceLineVisible: false, lastValueVisible: false,
          }, paneIdx));
        } else if (type === 'VWAP') {
          series.push(chart.addSeries(LineSeries, {
            color: settings.color, lineWidth: settings.thickness,
            priceLineVisible: false, lastValueVisible: false, lineStyle: LineStyle.Dashed,
          }, paneIdx));
        } else if (type === 'Volume') {
          const s = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }, paneIdx);
          s.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
          series.push(s);
        } else if (type === 'RSI') {
          const s = chart.addSeries(LineSeries, {
            color: settings.color, lineWidth: 1.5, priceLineVisible: false,
          }, paneIdx);
          s.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
          s.createPriceLine({ price: settings.obLevel, color: settings.obColor ?? '#ef5350', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          s.createPriceLine({ price: settings.osLevel, color: settings.osColor ?? '#26a69a', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
          series.push(s);
        } else if (type === 'MACD') {
          series.push(
            chart.addSeries(LineSeries, { color: settings.color,       lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false }, paneIdx),
            chart.addSeries(LineSeries, { color: settings.signalColor, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false }, paneIdx),
            chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, paneIdx),
          );
        }
      } catch { continue; }

      // Set data
      try {
        if (type === 'MA') {
          const d = calcMA(candleData, settings);
          series[0]?.setData(d);
          newBadgeValues[id] = d.at(-1)?.value;
        } else if (type === 'VWAP') {
          const d = calcVWAP(candleData);
          series[0]?.setData(d);
          newBadgeValues[id] = d.at(-1)?.value;
        } else if (type === 'Volume') {
          series[0]?.setData(calcVolume(candleData, settings));
        } else if (type === 'RSI') {
          const d = calcRSI(candleData, settings);
          series[0]?.setData(d);
          newBadgeValues[id] = d.at(-1)?.value;
        } else if (type === 'MACD') {
          const { macd, signal, hist } = calcMACD(candleData, settings);
          series[0]?.setData(macd);
          series[1]?.setData(signal);
          series[2]?.setData(hist);
          newBadgeValues[id] = macd.at(-1)?.value;
        }
      } catch {}

      // Visibility
      series.forEach(s => { try { s.applyOptions({ visible }); } catch {} });
      syncMapRef.current.set(id, { series, paneRef });
    }

    setBadgeValues(prev => ({ ...prev, ...newBadgeValues }));
    // Restore the saved zoom/scroll, or fitContent on first load
    if (visibleRangeRef.current) {
      try { chart.timeScale().setVisibleRange(visibleRangeRef.current); } catch { chart.timeScale().fitContent(); }
    } else {
      chart.timeScale().fitContent();
    }

  }, [candleData, indicators, chartType, height]); // single dep array — no split effects

  // ── Render ───────────────────────────────────────────────────────────────────
  const paneInds = indicators.filter(i => i.isPane);
  const totalHeight = height + Math.min(paneInds.length, 2) * 120;

  return (
    <div className="flex flex-col gap-2">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Chart type switcher */}
        <div className="flex rounded overflow-hidden border" style={{ borderColor: '#2a2e39' }}>
          {['candle', 'line', 'area'].map((t, i) => (
            <button key={t} onClick={() => setChartType(t)}
              className="px-3 py-1.5 text-xs font-medium transition capitalize"
              style={{
                background: chartType === t ? '#26a69a22' : 'transparent',
                color:      chartType === t ? '#26a69a'   : '#787b86',
                borderRight: i < 2 ? '1px solid #2a2e39' : 'none',
              }}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Indicators button */}
        <div className="relative">
          <button onClick={() => setModalOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition"
            style={{ borderColor: '#2a2e39', color: '#787b86' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#26a69a'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2e39'}>
            <Plus size={12}/> Indicators <ChevronDown size={11}/>
          </button>
          {modalOpen && <IndicatorModal onAdd={addIndicator} onClose={() => setModalOpen(false)}/>}
        </div>

        {/* Overlay badges */}
        <div className="flex flex-wrap gap-1">
          {indicators.filter(i => !i.isPane).map(ind => (
            <div key={ind.id} className="relative">
              <IndicatorBadge ind={ind} value={badgeValues[ind.id]}
                onToggle={() => toggleVisibility(ind.id)}
                onRemove={() => removeIndicator(ind.id)}
                onSettingsToggle={() => setOpenSettings(o => o === ind.id ? null : ind.id)}/>
              {openSettings === ind.id &&
                <IndicatorSettings ind={ind} onUpdate={p => updateSettings(ind.id, p)} onClose={() => setOpenSettings(null)}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="relative w-full rounded-lg overflow-hidden"
        style={{ border: '1px solid #2a2e39', height: totalHeight }}>

        {/* Crosshair tooltip */}
        {crosshair && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none flex gap-2 text-xs font-mono flex-wrap"
            style={{ background: '#1e222dcc', padding: '4px 8px', borderRadius: 4 }}>
            <span style={{ color: '#787b86' }}>{crosshair.time}</span>
            <span>O:<span style={{ color: '#d1d4dc' }}>{crosshair.open?.toFixed(2)}</span></span>
            <span>H:<span style={{ color: '#26a69a' }}>{crosshair.high?.toFixed(2)}</span></span>
            <span>L:<span style={{ color: '#ef5350' }}>{crosshair.low?.toFixed(2)}</span></span>
            <span>C:<span style={{ color: '#d1d4dc' }}>{crosshair.close?.toFixed(2)}</span></span>
            <span>V:<span style={{ color: '#787b86' }}>{crosshair.volume?.toLocaleString()}</span></span>
          </div>
        )}

        {/* Pane indicator badges */}
        {paneInds.length > 0 && (
          <div className="absolute bottom-1 left-2 z-10 flex flex-wrap gap-1 pointer-events-auto">
            {paneInds.map(ind => (
              <div key={ind.id} className="relative">
                <IndicatorBadge ind={ind} value={badgeValues[ind.id]}
                  onToggle={() => toggleVisibility(ind.id)}
                  onRemove={() => removeIndicator(ind.id)}
                  onSettingsToggle={() => setOpenSettings(o => o === ind.id ? null : ind.id)}/>
                {openSettings === ind.id &&
                  <IndicatorSettings ind={ind} onUpdate={p => updateSettings(ind.id, p)} onClose={() => setOpenSettings(null)}/>}
              </div>
            ))}
          </div>
        )}

        <div ref={containerRef} className="w-full h-full"/>
      </div>
    </div>
  );
}
