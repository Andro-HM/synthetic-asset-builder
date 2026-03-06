// src/utils/stats.js
// Pure statistical functions for pairs-trading research.
// All functions take plain JS arrays of close prices (numbers).
// No UI side-effects. No API calls.
// Uses mathjs for eigenvalue decomposition (Johansen test only).

import { matrix, multiply, transpose, inv, eigs } from 'mathjs';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Mean of an array. */
function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** Sample standard deviation. */
function std(arr) {
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Ordinary Least Squares regression.
 * X: 2-D array (n rows × k cols), y: 1-D array length n.
 * Returns { beta, residuals, se, sigma2, tStats }.
 */
function ols(X, y) {
  const n = y.length;
  const k = X[0].length;
  const Xm = matrix(X);
  const Xt = transpose(Xm);
  const XtX = multiply(Xt, Xm);
  const XtXinv = inv(XtX);
  const Xty = multiply(Xt, y);
  const beta = multiply(XtXinv, Xty).toArray();

  // Residuals
  const residuals = y.map((yi, i) => {
    const fitted = beta.reduce((s, b, j) => s + b * X[i][j], 0);
    return yi - fitted;
  });

  // Residual sum of squares
  const rss = residuals.reduce((s, e) => s + e * e, 0);
  const sigma2 = rss / (n - k);

  // Std errors of beta
  const diagXtXinv = XtXinv.toArray();
  const se = diagXtXinv.map((row, i) => Math.sqrt(Math.max(sigma2 * row[i], 0)));
  const tStats = beta.map((b, i) => (se[i] > 0 ? b / se[i] : 0));

  return { beta, residuals, se, sigma2, tStats, rss };
}

/**
 * Simple univariate OLS: y ~ x + 1. Returns { slope, intercept, residuals }.
 */
function simpleOLS(x, y) {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  const sxy = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const sxx = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const residuals = x.map((xi, i) => y[i] - (intercept + slope * xi));
  return { slope, intercept, residuals };
}

/**
 * Newey-West long-run variance estimator.
 * e: array of residuals, bw: bandwidth (lags to include).
 */
function neweyWestVariance(e, bw) {
  const n = e.length;
  let nwVar = e.reduce((s, ei) => s + ei * ei, 0) / n;
  for (let l = 1; l <= bw; l++) {
    const weight = 1 - l / (bw + 1);
    let cov = 0;
    for (let t = l; t < n; t++) {
      cov += e[t] * e[t - l];
    }
    nwVar += 2 * weight * (cov / n);
  }
  return Math.max(nwVar, 1e-12); // guard against zero
}

/**
 * Build the ADF design matrix.
 * Returns rows of [y[t-1], Δy[t-1], ..., Δy[t-p], 1] for t = p+1..n-1.
 */
function buildADFMatrix(y, dy, p) {
  const rows = [];
  for (let t = p; t < dy.length; t++) {
    const row = [y[t]]; // lagged level (coefficient of interest)
    for (let l = 1; l <= p; l++) {
      row.push(dy[t - l]); // lagged differences
    }
    row.push(1); // constant
    rows.push(row);
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// MacKinnon (1994) ADF critical values — with constant, no trend.
// Approximated using the response surface for finite n.
// ─────────────────────────────────────────────────────────────────────────────
const ADF_CV = { p01: -3.4336, p05: -2.8621, p10: -2.5671 };

/**
 * Approximate ADF p-value from the t-statistic using the
 * MacKinnon (1996) regression response surface.
 * Returns a rough p-value in [0,1].
 */
function adfPvalue(tau) {
  // Fitted polynomial approximation to MacKinnon (1996) Table 1, nc=1 (constant only)
  // Coefficients from: tau ~> percentile mapping
  // We use a simple step-based approximation here.
  if (tau < -4.38) return 0.001;
  if (tau < ADF_CV.p01) return 0.01;
  if (tau < ADF_CV.p05) return 0.05;
  if (tau < ADF_CV.p10) return 0.10;
  return 0.95;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADF — Augmented Dickey-Fuller Test
// H0: unit root (non-stationary). H1: stationary.
// A p-value < 0.05 → reject H0 → evidence of stationarity.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number[]} closes
 * @returns {{ stat: number, pvalue: number, lag: number, critValues: object, isStationary: boolean, verdict: string }}
 */
export function runADF(closes) {
  const n = closes.length;
  if (n < 20) throw new Error('ADF requires at least 20 observations.');

  // First differences
  const dy = closes.slice(1).map((v, i) => v - closes[i]);

  // Select lag by AIC (max lag = floor(12*(n/100)^0.25), per Schwert 1989)
  const maxLag = Math.min(Math.floor(12 * Math.pow(n / 100, 0.25)), 12);
  let bestAIC = Infinity;
  let bestLag = 0;

  for (let p = 0; p <= maxLag; p++) {
    const X = buildADFMatrix(closes, dy, p);
    const ySlice = dy.slice(p);
    if (X.length < X[0].length + 2) continue; // not enough obs
    try {
      const { rss } = ols(X, ySlice);
      const k = X[0].length;
      const np = X.length;
      const aic = np * Math.log(rss / np) + 2 * k;
      if (aic < bestAIC) { bestAIC = aic; bestLag = p; }
    } catch { /* skip degenerate lag */ }
  }

  // Run final ADF regression at bestLag
  const X = buildADFMatrix(closes, dy, bestLag);
  const ySlice = dy.slice(bestLag);
  const { tStats } = ols(X, ySlice);

  // t-statistic on the lagged level (first regressor)
  const stat = tStats[0];
  const pvalue = adfPvalue(stat);

  return {
    stat: +stat.toFixed(4),
    pvalue,
    lag: bestLag,
    critValues: ADF_CV,
    isStationary: stat < ADF_CV.p05,
    verdict: stat < ADF_CV.p05
      ? 'MEAN-REVERTING'
      : 'NON-STATIONARY',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. KPSS — Kwiatkowski-Phillips-Schmidt-Shin Test
// H0: stationary. H1: unit root.
// A high KPSS stat (p-value < 0.05) → reject H0 → non-stationary.
// ─────────────────────────────────────────────────────────────────────────────

const KPSS_CV = { p10: 0.347, p05: 0.463, p025: 0.574, p01: 0.739 };

/**
 * @param {number[]} closes
 * @returns {{ stat: number, critValues: object, isStationary: boolean, verdict: string }}
 */
export function runKPSS(closes) {
  const n = closes.length;
  if (n < 10) throw new Error('KPSS requires at least 10 observations.');

  // Detrend: remove the mean (level stationarity test)
  const m = mean(closes);
  const e = closes.map(v => v - m);

  // Partial (cumulative) sums
  const S = [];
  let cumSum = 0;
  for (const ei of e) { cumSum += ei; S.push(cumSum); }

  // Long-run variance via Newey-West (bandwidth = floor(4*(n/100)^0.25))
  const bw = Math.max(1, Math.floor(4 * Math.pow(n / 100, 0.25)));
  const lrv = neweyWestVariance(e, bw);

  // KPSS statistic
  const stat = S.reduce((s, si) => s + si * si, 0) / (n * n * lrv);

  return {
    stat: +stat.toFixed(4),
    critValues: KPSS_CV,
    isStationary: stat < KPSS_CV.p05,
    verdict: stat < KPSS_CV.p05 ? 'STATIONARY' : 'NON-STATIONARY',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED ADF + KPSS VERDICT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combines ADF and KPSS results into a single cointegration verdict.
 * @returns 'STRONG_MR' | 'INCONCLUSIVE' | 'NON_STATIONARY'
 */
export function combinedVerdict(adf, kpss) {
  if (adf.isStationary && kpss.isStationary) return 'STRONG_MR';
  if (adf.isStationary || kpss.isStationary) return 'INCONCLUSIVE';
  return 'NON_STATIONARY';
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. HURST EXPONENT — R/S Analysis
// H < 0.5: mean-reverting. H ≈ 0.5: random walk. H > 0.5: trending.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number[]} closes
 * @returns {{ H: number, verdict: string, label: string }}
 */
export function runHurst(closes) {
  const n = closes.length;
  if (n < 32) throw new Error('Hurst requires at least 32 observations.');

  // Generate window sizes as powers of 2 up to n/4
  const sizes = [];
  for (let s = 8; s <= n / 4; s *= 2) sizes.push(s);
  if (sizes.length < 2) throw new Error('Series too short for reliable Hurst estimation.');

  const logN = [], logRS = [];

  for (const size of sizes) {
    const numChunks = Math.floor(n / size);
    const rsValues = [];

    for (let c = 0; c < numChunks; c++) {
      const chunk = closes.slice(c * size, (c + 1) * size);
      const m = mean(chunk);
      // Mean-adjusted cumulative sum ("profile")
      let cum = 0;
      const profile = chunk.map(v => { cum += v - m; return cum; });
      const R = Math.max(...profile) - Math.min(...profile);
      const S = std(chunk);
      if (S > 0) rsValues.push(R / S);
    }

    if (rsValues.length > 0) {
      logN.push(Math.log(size));
      logRS.push(Math.log(mean(rsValues)));
    }
  }

  // OLS: log(RS) ~ H * log(n)  →  fit slope = H
  const { slope: H } = simpleOLS(logN, logRS);

  let verdict, label;
  if (H < 0.45)      { verdict = 'MEAN-REVERTING'; label = `H = ${H.toFixed(3)} < 0.5`; }
  else if (H < 0.55) { verdict = 'RANDOM WALK';    label = `H = ${H.toFixed(3)} ≈ 0.5`; }
  else                { verdict = 'TRENDING';        label = `H = ${H.toFixed(3)} > 0.5`; }

  return { H: +H.toFixed(4), verdict, label };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HALF-LIFE OF MEAN REVERSION (Ornstein-Uhlenbeck)
// Fits: Δy(t) = λ·y(t-1) + μ + ε
// Half-life = −ln(2) / λ   (λ must be negative for mean reversion)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number[]} closes
 * @returns {{ halfLife: number, lambda: number, isValid: boolean, verdict: string }}
 */
export function runHalfLife(closes) {
  const n = closes.length;
  if (n < 10) throw new Error('Half-life requires at least 10 observations.');

  // Δy(t): first differences
  const dy = closes.slice(1).map((v, i) => v - closes[i]);
  // y(t-1): lagged levels
  const yLag = closes.slice(0, n - 1);

  const { slope: lambda, intercept: mu } = simpleOLS(yLag, dy);

  // Half-life formula: -ln(2) / λ
  // λ must be in (-1, 0) for a stationary, mean-reverting OU process
  const halfLife = -Math.LN2 / lambda;

  let verdict;
  if (lambda >= 0) {
    verdict = 'NON-MEAN-REVERTING (λ ≥ 0)';
  } else if (halfLife < 2) {
    verdict = 'TOO SHORT (noise)';
  } else if (halfLife > 252) {
    verdict = 'TOO LONG (>1 year)';
  } else {
    verdict = `TRADEABLE (${halfLife.toFixed(1)} days)`;
  }

  return {
    halfLife: isFinite(halfLife) ? +halfLife.toFixed(2) : Infinity,
    lambda: +lambda.toFixed(6),
    mu: +mu.toFixed(6),
    isValid: lambda < 0 && halfLife > 0 && halfLife < 500,
    verdict,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ENGLE-GRANGER COINTEGRATION TEST (2 series)
// Step 1: OLS regression of A on B → hedge ratio (β)
// Step 2: ADF on residuals → test if spread is stationary
// ─────────────────────────────────────────────────────────────────────────────

// EG critical values differ slightly from standard ADF (residuals are estimated),
// using MacKinnon (1994) values for 2 variables, no trend.
const EG_CV = { p01: -3.896, p05: -3.362, p10: -3.108 };

/**
 * @param {number[]} closesA
 * @param {number[]} closesB
 * @returns {{ hedgeRatio: number, adfStat: number, critValues: object, isCointegrated: boolean, verdict: string }}
 */
export function runEngleGranger(closesA, closesB) {
  if (closesA.length !== closesB.length) {
    throw new Error('Engle-Granger: series must have equal length.');
  }
  const n = closesA.length;
  if (n < 30) throw new Error('Engle-Granger requires at least 30 observations.');

  // Step 1: OLS  A = α + β·B + ε
  const { slope: hedgeRatio, intercept, residuals } = simpleOLS(closesB, closesA);

  // Step 2: ADF on residuals (with no constant — residuals are already zero-mean by OLS)
  // We reuse our ADF but applied to the residuals series.
  const adfResult = runADF(residuals);
  const stat = adfResult.stat;

  return {
    hedgeRatio: +hedgeRatio.toFixed(6),
    spread: `A − ${hedgeRatio.toFixed(3)}·B`,
    adfStat: stat,
    critValues: EG_CV,
    isCointegrated: stat < EG_CV.p05,
    verdict: stat < EG_CV.p05 ? 'COINTEGRATED' : 'NOT COINTEGRATED',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. JOHANSEN COINTEGRATION TEST (2+ series)
// Based on: Johansen (1988), using reduced rank VAR(1).
// Computes trace and max-eigenvalue statistics.
// ─────────────────────────────────────────────────────────────────────────────

// Johansen trace-test critical values (at 5%) for k-r cointegrating equations, no trend.
// Rows indexed by r (number of cointegrating equations to test), cols by k (# series).
// Source: Osterwald-Lenum (1992) Table 1.
const JOHANSEN_TRACE_CV05 = [
  [3.84, 15.41, 29.68, 47.21],  // r=0
  [null,  3.84, 15.41, 29.68],  // r=1
  [null,  null,  3.84, 15.41],  // r=2
  [null,  null,  null,  3.84],  // r=3
];

/**
 * @param {number[][]} closeArrays  Each inner array is one asset's close series (already aligned, same length).
 * @returns {{ eigenvalues, traceStat, maxEigStat, numCointegrating, eigenvectors, verdict }}
 */
export function runJohansen(closeArrays) {
  const k = closeArrays.length;
  const n = closeArrays[0].length;
  if (n < 50) throw new Error('Johansen requires at least 50 observations per series.');
  if (k < 2) throw new Error('Johansen requires at least 2 series.');

  // Form the data matrix Y: n × k  (each column = one series)
  const Y = Array.from({ length: n }, (_, i) => closeArrays.map(s => s[i]));

  // Compute first differences ΔY: (n-1) × k
  const dY = Array.from({ length: n - 1 }, (_, t) =>
    Y[t + 1].map((v, j) => v - Y[t][j])
  );
  const Y0 = Y.slice(0, n - 1); // lagged levels: (n-1) × k

  // For VAR(1), we regress ΔY on Y[t-1] to get the Π matrix.
  // We use mathjs for the matrix algebra here.
  const dYm = matrix(dY);       // (n-1) × k
  const Y0m = matrix(Y0);       // (n-1) × k

  // S00 = (1/n) · ΔY' · ΔY
  const S00 = multiply(transpose(dYm), dYm).toArray().map(r => r.map(v => v / (n - 1)));
  // S11 = (1/n) · Y₀' · Y₀
  const S11 = multiply(transpose(Y0m), Y0m).toArray().map(r => r.map(v => v / (n - 1)));
  // S01 = (1/n) · ΔY' · Y₀
  const S01 = multiply(transpose(dYm), Y0m).toArray().map(r => r.map(v => v / (n - 1)));
  // S10 = S01'
  const S10 = matrix(S01).map((v, [i, j]) => matrix(S01).get([j, i])).toArray
    ? transpose(matrix(S01)).toArray()
    : S01[0].map((_, j) => S01.map(r => r[j])); // manual transpose fallback

  // Form M = S11^{-1} · S10 · S00^{-1} · S01
  // Eigenvalues of M give the Johansen test statistics.
  const S11inv = inv(matrix(S11));
  const S00inv = inv(matrix(S00));
  const M = multiply(multiply(multiply(S11inv, matrix(S10)), S00inv), matrix(S01));

  // mathjs eigs() returns { values, eigenvectors } — NOT { values, vectors }
  const { values: eigVals, eigenvectors: eigVecs } = eigs(M);

  // Sort eigenvalues descending (they should be real and positive for cov matrices)
  const eigenvalues = (Array.isArray(eigVals) ? eigVals : eigVals.toArray())
    .map(v => (typeof v === 'object' && v.re !== undefined) ? v.re : +v)
    .filter(v => isFinite(v) && v > 0);
  eigenvalues.sort((a, b) => b - a);

  const kUsed = Math.min(k, eigenvalues.length);
  const nObs = n - 1;

  // Trace statistic: tests H(r) vs H(k) — is r the number of cointegrating vectors?
  // Trace(r) = -n · Σ_{i=r+1}^{k} ln(1 - λᵢ)
  const traceStats = [];
  for (let r = 0; r < kUsed; r++) {
    let ts = 0;
    for (let i = r; i < kUsed; i++) {
      ts += Math.log(1 - Math.min(eigenvalues[i], 0.9999));
    }
    traceStats.push(-nObs * ts);
  }

  // Max-eigenvalue statistic: -n · ln(1 - λ_{r+1})
  const maxEigStats = eigenvalues.map(ev => -nObs * Math.log(1 - Math.min(ev, 0.9999)));

  // Determine number of cointegrating relationships (r) using 5% trace critical values
  let numCointegrating = 0;
  const cvRow0 = JOHANSEN_TRACE_CV05[0][Math.min(k, 4) - 1];
  if (traceStats[0] > (cvRow0 || 15.41)) numCointegrating++;
  if (kUsed >= 2 && traceStats[1] > (JOHANSEN_TRACE_CV05[1][Math.min(k, 4) - 1] || 3.84)) numCointegrating++;

  // Extract eigenvectors (hedge ratios) from mathjs output
  let eigenvectors = [];
  try {
    const vecsArr = eigVecs.toArray ? eigVecs.toArray() : eigVecs;
    // eigenvectors are columns of vecsArr
    eigenvectors = eigenvalues.slice(0, numCointegrating).map((_, ci) =>
      vecsArr.map(row => {
        const v = row[ci];
        return typeof v === 'object' && v.re !== undefined ? +v.re.toFixed(4) : +v.toFixed(4);
      })
    );
  } catch { eigenvectors = []; }

  return {
    eigenvalues: eigenvalues.map(v => +v.toFixed(6)),
    traceStats: traceStats.map(v => +v.toFixed(4)),
    maxEigStats: maxEigStats.map(v => +v.toFixed(4)),
    numCointegrating,
    eigenvectors,
    verdict: numCointegrating > 0
      ? `${numCointegrating} COINTEGRATING VECTOR${numCointegrating > 1 ? 'S' : ''}`
      : 'NO COINTEGRATION',
    isCointegrated: numCointegrating > 0,
    k: kUsed,
  };
}
