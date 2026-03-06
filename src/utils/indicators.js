// src/utils/indicators.js
// Pure indicator math — no UI, no side-effects.
// All public functions take `bars` (OHLCV array) + settings and return [{time, value}].

// ─── Source Selector ──────────────────────────────────────────────────────────
export function getSource(bars, src = 'close') {
  switch (src) {
    case 'open':  return bars.map(b => b.open);
    case 'high':  return bars.map(b => b.high);
    case 'low':   return bars.map(b => b.low);
    case 'hlc3':  return bars.map(b => (b.high + b.low + b.close) / 3);
    case 'ohlc4': return bars.map(b => (b.open + b.high + b.low + b.close) / 4);
    default:      return bars.map(b => b.close);
  }
}

// ─── Internal: filter NaN → [{time, value}] ───────────────────────────────────
function toSeries(times, values) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (isFinite(values[i]) && !isNaN(values[i])) out.push({ time: times[i], value: values[i] });
  }
  return out;
}

// ─── Primitive MA building blocks (all return same-length arrays with leading NaN) ──

/** Simple Moving Average */
function smaFull(src, period) {
  const out = new Array(src.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += isNaN(src[i]) ? 0 : src[i];
    if (i >= period) sum -= isNaN(src[i - period]) ? 0 : src[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * EMA seeded with the SMA of the first `period` values.
 * Handles NaN in src by carrying the previous value forward.
 */
function emaFull(src, period) {
  const k = 2 / (period + 1);
  const out = new Array(src.length).fill(NaN);
  // find first valid run of `period` non-NaN values
  let start = -1;
  for (let i = 0; i <= src.length - period; i++) {
    if (src.slice(i, i + period).every(v => !isNaN(v))) { start = i; break; }
  }
  if (start < 0) return out;
  let sum = 0;
  for (let i = start; i < start + period; i++) sum += src[i];
  out[start + period - 1] = sum / period;
  for (let i = start + period; i < src.length; i++) {
    const v = isNaN(src[i]) ? out[i - 1] : src[i];
    out[i] = v * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** Wilder's / RMA smoothing: k = 1/period */
function rmaFull(src, period) {
  const k = 1 / period;
  const out = new Array(src.length).fill(NaN);
  let start = -1;
  for (let i = 0; i <= src.length - period; i++) {
    if (src.slice(i, i + period).every(v => !isNaN(v))) { start = i; break; }
  }
  if (start < 0) return out;
  let sum = 0;
  for (let i = start; i < start + period; i++) sum += src[i];
  out[start + period - 1] = sum / period;
  for (let i = start + period; i < src.length; i++) {
    const v = isNaN(src[i]) ? out[i - 1] : src[i];
    out[i] = v * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** Linearly Weighted MA */
function wmaFull(src, period) {
  const out = new Array(src.length).fill(NaN);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < src.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += (period - j) * (src[i - j] ?? 0);
    out[i] = s / denom;
  }
  return out;
}

/** Rolling sample standard deviation */
function stdevFull(src, period) {
  const out = new Array(src.length).fill(NaN);
  for (let i = period - 1; i < src.length; i++) {
    const sl = src.slice(i - period + 1, i + 1).filter(v => !isNaN(v));
    if (sl.length < 2) continue;
    const m = sl.reduce((a, v) => a + v, 0) / sl.length;
    out[i] = Math.sqrt(sl.reduce((a, v) => a + (v - m) ** 2, 0) / (sl.length - 1));
  }
  return out;
}

// ─── Moving Averages ──────────────────────────────────────────────────────────

function demaFull(src, period) {
  const e1 = emaFull(src, period);
  const e2 = emaFull(e1, period);
  return e1.map((v, i) => isNaN(v) || isNaN(e2[i]) ? NaN : 2 * v - e2[i]);
}

function temaFull(src, period) {
  const e1 = emaFull(src, period);
  const e2 = emaFull(e1, period);
  const e3 = emaFull(e2, period);
  return e1.map((v, i) => isNaN(v) || isNaN(e2[i]) || isNaN(e3[i]) ? NaN : 3 * v - 3 * e2[i] + e3[i]);
}

/** Triangular MA: SMA of SMA */
function trimaFull(src, period) {
  return smaFull(smaFull(src, Math.ceil(period / 2)), Math.ceil(period / 2));
}

/**
 * T3 (Tillson) — six EMA cascade.
 * T3 = c1·e1 + c2·e2 + c3·e3 + c4·e4
 * where a=1+vf, b=-vf: c1=a³, c2=3a²b, c3=3ab², c4=b³
 * Default vf=0.7 (Tillson's original setting).
 */
function t3Full(src, period, vf = 0.7) {
  const e1 = emaFull(src, period);
  const e2 = emaFull(e1, period);
  const e3 = emaFull(e2, period);
  const e4 = emaFull(e3, period);
  const a = 1 + vf, b = -vf;
  const [c1, c2, c3, c4] = [a ** 3, 3 * a ** 2 * b, 3 * a * b ** 2, b ** 3];
  return e1.map((_, i) =>
    [e1[i], e2[i], e3[i], e4[i]].some(isNaN) ? NaN : c1 * e1[i] + c2 * e2[i] + c3 * e3[i] + c4 * e4[i]
  );
}

/**
 * ALMA — Arnaud Legoux MA.
 * Gaussian-weighted window.  offset (0–1) controls centre, sigma controls width.
 */
function almaFull(src, period, offset = 0.85, sigma = 6) {
  const m = offset * (period - 1);
  const s = period / sigma;
  const raw = Array.from({ length: period }, (_, i) => Math.exp(-((i - m) ** 2) / (2 * s * s)));
  const wsum = raw.reduce((a, v) => a + v, 0);
  const w = raw.map(v => v / wsum);
  const out = new Array(src.length).fill(NaN);
  for (let i = period - 1; i < src.length; i++) {
    let val = 0;
    for (let j = 0; j < period; j++) val += w[j] * src[i - period + 1 + j];
    out[i] = val;
  }
  return out;
}

/**
 * KAMA — Kaufman Adaptive MA.
 * Efficiency Ratio ER = |direction| / volatility controls smoothing between fast and slow EMA rates.
 */
function kamaFull(src, period, fast = 2, slow = 30) {
  const fastSC = 2 / (fast + 1), slowSC = 2 / (slow + 1);
  const out = new Array(src.length).fill(NaN);
  out[period - 1] = src[period - 1];
  for (let i = period; i < src.length; i++) {
    const direction = Math.abs(src[i] - src[i - period]);
    let vol = 0;
    for (let j = i - period + 1; j <= i; j++) vol += Math.abs(src[j] - src[j - 1]);
    const er = vol > 0 ? direction / vol : 0;
    const sc = (er * (fastSC - slowSC) + slowSC) ** 2;
    out[i] = out[i - 1] + sc * (src[i] - out[i - 1]);
  }
  return out;
}

/**
 * FRAMA — Fractal Adaptive MA.
 * Uses the fractal dimension D of price H/L ranges to derive an adaptive alpha.
 * D approaches 1 for trending, 2 for random/noise.
 * alpha = exp(-4.6*(D-1)); high D → small alpha (slow MA).
 * NOTE: requires bars for high/low, not just close.
 */
function framaFull(bars, period) {
  const p = period % 2 === 0 ? period : period + 1; // must be even
  const half = p / 2;
  const out = new Array(bars.length).fill(NaN);
  out[p - 1] = bars[p - 1].close;
  for (let i = p; i < bars.length; i++) {
    // First half H/L
    let h1 = -Infinity, l1 = Infinity;
    for (let j = i - p + 1; j < i - half + 1; j++) { h1 = Math.max(h1, bars[j].high); l1 = Math.min(l1, bars[j].low); }
    // Second half H/L
    let h2 = -Infinity, l2 = Infinity;
    for (let j = i - half + 1; j <= i; j++) { h2 = Math.max(h2, bars[j].high); l2 = Math.min(l2, bars[j].low); }
    const N1 = (h1 - l1) / half, N2 = (h2 - l2) / half;
    const N = (Math.max(h1, h2) - Math.min(l1, l2)) / p;
    let D = N1 + N2 > 0 && N > 0 ? (Math.log(N1 + N2) - Math.log(N)) / Math.log(2) : 1;
    D = Math.max(1, Math.min(2, D));
    const alpha = Math.min(1, Math.max(0.01, Math.exp(-4.6 * (D - 1))));
    out[i] = alpha * bars[i].close + (1 - alpha) * out[i - 1];
  }
  return out;
}

/** LSMA — Linear Regression value at the end of a rolling window (forecast point). */
function lsmaFull(src, period) {
  const out = new Array(src.length).fill(NaN);
  const xMean = (period - 1) / 2;
  for (let i = period - 1; i < src.length; i++) {
    const sl = src.slice(i - period + 1, i + 1);
    const yMean = sl.reduce((a, v) => a + v, 0) / period;
    let sxy = 0, sxx = 0;
    for (let j = 0; j < period; j++) { sxy += (j - xMean) * (sl[j] - yMean); sxx += (j - xMean) ** 2; }
    const b = sxy / sxx;
    out[i] = yMean + b * (xMean);   // value at the last point = yMean + b*(period-1-xMean) = yMean + b*xMean
  }
  return out;
}

/** HMA = WMA(2·WMA(n/2) − WMA(n), √n) */
function hmaFull(src, period) {
  const half = Math.round(period / 2), sq = Math.round(Math.sqrt(period));
  const w1 = wmaFull(src, half), w2 = wmaFull(src, period);
  const diff = w1.map((v, i) => isNaN(v) || isNaN(w2[i]) ? NaN : 2 * v - w2[i]);
  return wmaFull(diff, sq);
}

/** EHMA = EMA(2·EMA(n/2) − EMA(n), √n) */
function ehmaFull(src, period) {
  const half = Math.round(period / 2), sq = Math.round(Math.sqrt(period));
  const e1 = emaFull(src, half), e2 = emaFull(src, period);
  const diff = e1.map((v, i) => isNaN(v) || isNaN(e2[i]) ? NaN : 2 * v - e2[i]);
  return emaFull(diff, sq);
}

/** THMA = WMA(3·WMA(n/3) − WMA(n/2) − WMA(n), n/3) */
function thmaFull(src, period) {
  const p3 = Math.max(2, Math.round(period / 3));
  const p2 = Math.max(2, Math.round(period / 2));
  const w1 = wmaFull(src, p3), w2 = wmaFull(src, p2), w3 = wmaFull(src, period);
  const diff = w1.map((v, i) => [v, w2[i], w3[i]].some(isNaN) ? NaN : 3 * v - w2[i] - w3[i]);
  return wmaFull(diff, p3);
}

/** ZLMA = EMA(2·src − src[lag], period), lag = ⌊(period−1)/2⌋ */
function zlmaFull(src, period) {
  const lag = Math.floor((period - 1) / 2);
  const delagged = src.map((v, i) => i >= lag ? 2 * v - src[i - lag] : v);
  return emaFull(delagged, period);
}

/** SWMA — Sine-Weighted MA with sine weights over the period. */
function swmaFull(src, period) {
  const weights = Array.from({ length: period }, (_, i) => Math.sin(Math.PI * (i + 1) / (period + 1)));
  const wsum = weights.reduce((a, v) => a + v, 0);
  const out = new Array(src.length).fill(NaN);
  for (let i = period - 1; i < src.length; i++) {
    let val = 0;
    for (let j = 0; j < period; j++) val += weights[j] * src[i - period + 1 + j];
    out[i] = val / wsum;
  }
  return out;
}

/**
 * McGinley Dynamic.
 * MD[t] = MD[t-1] + (src[t] − MD[t-1]) / (k · n · (src[t]/MD[t-1])^4)
 * k=0.6 per McGinley's paper. Self-adjusts for market speed.
 */
function mcginleyFull(src, period) {
  const k = 0.6;
  const out = new Array(src.length).fill(NaN);
  out[0] = src[0];
  for (let i = 1; i < src.length; i++) {
    if (isNaN(out[i - 1]) || out[i - 1] === 0) { out[i] = src[i]; continue; }
    const ratio = src[i] / out[i - 1];
    out[i] = out[i - 1] + (src[i] - out[i - 1]) / (k * period * ratio ** 4);
  }
  return out;
}

/**
 * VAMA — Volatility Adaptive MA.
 * Adjusts the EMA smoothing factor proportionally to short-term vs long-term volatility.
 */
function vamaFull(src, period) {
  const refPeriod = period * 3;
  const shortVol = stdevFull(src, period);
  const longVol = stdevFull(src, refPeriod);
  const out = new Array(src.length).fill(NaN);
  for (let i = refPeriod - 1; i < src.length; i++) {
    const ratio = longVol[i] > 0 ? Math.max(0.1, Math.min(2, shortVol[i] / longVol[i])) : 1;
    const adaptPeriod = Math.max(2, Math.round(period / ratio));
    const k = 2 / (adaptPeriod + 1);
    out[i] = isNaN(out[i - 1]) ? src[i] : src[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** VWMA — Volume Weighted MA. Needs bars (not just src) for volume. */
function vwmaFull(bars, period) {
  const out = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let pv = 0, vol = 0;
    for (let j = i - period + 1; j <= i; j++) { pv += bars[j].close * bars[j].volume; vol += bars[j].volume; }
    out[i] = vol > 0 ? pv / vol : bars[i].close;
  }
  return out;
}

// ─── Public: calcMA ───────────────────────────────────────────────────────────

/** Dispatcher — returns [{time, value}] for any MA type. */
export function calcMA(bars, settings) {
  const { type = 'EMA', period = 20, source = 'close', vf = 0.7, offset = 0.85, sigma = 6 } = settings;
  const times = bars.map(b => b.time);
  const src = getSource(bars, source);
  let values;
  switch (type) {
    case 'SMA':      values = smaFull(src, period); break;
    case 'EMA':      values = emaFull(src, period); break;
    case 'RMA':
    case 'SMMA':     values = rmaFull(src, period); break;
    case 'WMA':      values = wmaFull(src, period); break;
    case 'VWMA':     values = vwmaFull(bars, period); break;
    case 'DEMA':     values = demaFull(src, period); break;
    case 'TEMA':     values = temaFull(src, period); break;
    case 'TRIMA':    values = trimaFull(src, period); break;
    case 'T3':       values = t3Full(src, period, vf); break;
    case 'ALMA':     values = almaFull(src, period, offset, sigma); break;
    case 'KAMA':     values = kamaFull(src, period); break;
    case 'FRAMA':    values = framaFull(bars, period); break;
    case 'LSMA':     values = lsmaFull(src, period); break;
    case 'HMA':      values = hmaFull(src, period); break;
    case 'EHMA':     values = ehmaFull(src, period); break;
    case 'THMA':     values = thmaFull(src, period); break;
    case 'ZLMA':     values = zlmaFull(src, period); break;
    case 'SWMA':     values = swmaFull(src, period); break;
    case 'McGinley': values = mcginleyFull(src, period); break;
    case 'VAMA':     values = vamaFull(src, period); break;
    default:         values = emaFull(src, period);
  }
  return toSeries(times, values);
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────

/**
 * VWAP — Volume Weighted Average Price.
 * On daily bars there is no intraday session to reset to, so this is a running
 * cumulative VWAP from bar 0 of the loaded series (essentially a rolling anchored VWAP).
 * It is NOT a true intraday VWAP. Useful as a long-term price fairness reference.
 */
export function calcVWAP(bars) {
  const out = [];
  let cumPV = 0, cumVol = 0;
  for (const b of bars) {
    const typicalPrice = (b.high + b.low + b.close) / 3;
    cumPV += typicalPrice * b.volume;
    cumVol += b.volume;
    if (cumVol > 0) out.push({ time: b.time, value: cumPV / cumVol });
  }
  return out;
}

// ─── RSI ─────────────────────────────────────────────────────────────────────

/** RSI using Wilder's RMA smoothing on gains/losses. */
export function calcRSI(bars, settings = {}) {
  const { period = 14, source = 'close' } = settings;
  const src = getSource(bars, source);
  const times = bars.map(b => b.time);
  const gains = new Array(src.length).fill(NaN);
  const losses = new Array(src.length).fill(NaN);
  for (let i = 1; i < src.length; i++) {
    const d = src[i] - src[i - 1];
    gains[i] = d > 0 ? d : 0;
    losses[i] = d < 0 ? -d : 0;
  }
  const avgGain = rmaFull(gains.slice(1), period);
  const avgLoss = rmaFull(losses.slice(1), period);
  const rsiValues = new Array(src.length).fill(NaN);
  for (let i = 0; i < avgGain.length; i++) {
    const g = avgGain[i], l = avgLoss[i];
    if (isNaN(g) || isNaN(l)) continue;
    rsiValues[i + 1] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return toSeries(times, rsiValues);
}

// ─── MACD ────────────────────────────────────────────────────────────────────

/** MACD — fast EMA − slow EMA, with signal EMA and histogram. */
export function calcMACD(bars, settings = {}) {
  const { fast = 12, slow = 26, signal = 9, source = 'close' } = settings;
  const src = getSource(bars, source);
  const times = bars.map(b => b.time);
  const eFast = emaFull(src, fast);
  const eSlow = emaFull(src, slow);
  const macdLine = eFast.map((v, i) => isNaN(v) || isNaN(eSlow[i]) ? NaN : v - eSlow[i]);
  const signalLine = emaFull(macdLine, signal);
  const histLine = macdLine.map((v, i) => isNaN(v) || isNaN(signalLine[i]) ? NaN : v - signalLine[i]);
  return {
    macd:   toSeries(times, macdLine),
    signal: toSeries(times, signalLine),
    hist:   toSeries(times, histLine).map(p => ({
      ...p, color: p.value >= 0 ? '#26a69a' : '#ef5350',
    })),
  };
}

// ─── Volume (coloured histogram) ─────────────────────────────────────────────

export function calcVolume(bars, settings = {}) {
  const { upColor = '#26a69a66', downColor = '#ef535066' } = settings;
  return bars.map(b => ({
    time: b.time,
    value: b.volume ?? 0,
    color: b.close >= b.open ? upColor : downColor,
  }));
}
