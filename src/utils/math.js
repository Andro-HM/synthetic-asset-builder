// src/utils/math.js

/**
 * Finds the earliest common start date across multiple datasets.
 * Datasets must be arrays sorted by time.
 * @param {Array<Array<{time: string}>>} datasets 
 * @returns {string | null} YYYY-MM-DD
 */
export function getIntersectionStart(datasets) {
  if (!datasets || datasets.length === 0) return null;
  
  let latestStart = '';

  for (const series of datasets) {
    if (series.length === 0) return null;
    const seriesStart = series[0].time;
    if (seriesStart > latestStart) {
      latestStart = seriesStart;
    }
  }

  return latestStart || null;
}

/**
 * Builds a sorted unique list of all trading dates across datasets from intersectionStart onwards.
 * @param {Array<Array<{time: string}>>} datasets 
 * @param {string} intersectionStart 
 * @returns {Array<string>}
 */
export function buildDateUnion(datasets, intersectionStart) {
  const dateSet = new Set();
  
  for (const series of datasets) {
    for (const point of series) {
      if (point.time >= intersectionStart) {
        dateSet.add(point.time);
      }
    }
  }
  
  const sortedDates = Array.from(dateSet).sort();
  return sortedDates;
}

/**
 * Forward fills a dataset based on a master date union.
 * Assumes dates are YYYY-MM-DD strings and unionDates is sorted.
 * @param {Array<{time: string, open: number, high: number, low: number, close: number, volume: number}>} dataset 
 * @param {Array<string>} unionDates 
 * @returns {Array<{time: string, open: number, high: number, low: number, close: number, volume: number}>}
 */
export function forwardFillMissingData(dataset, unionDates) {
  if (dataset.length === 0 || unionDates.length === 0) return [];

  // Create a map for fast lookup
  const dataMap = new Map();
  for (const point of dataset) {
    dataMap.set(point.time, point);
  }

  const alignedData = [];
  
  // To handle the first element correctly if it happens to be missing right at the union start
  // (which shouldn't happen by definition of intersectionStart, but just in case)
  let lastKnown = dataset.find(d => d.time <= unionDates[0]) || dataset[0];

  for (const date of unionDates) {
    if (dataMap.has(date)) {
      lastKnown = dataMap.get(date);
    }
    // We strictly push the 'lastKnown' into the current slot (Forward Fill)
    alignedData.push({
      time: date,
      open: lastKnown.open,
      high: lastKnown.high,
      low: lastKnown.low,
      close: lastKnown.close,
      volume: lastKnown.volume
    });
  }

  return alignedData;
}

/**
 * Computes the synthetic OHLCV given aligned (same length, same dates) datasets and their weights.
 * @param {Array<Array<{time: string, open: number, high: number, low: number, close: number, volume: number}>>} alignedDatasets 
 * @param {Array<number>} weights 
 * @returns {Array<{time: string, open: number, high: number, low: number, close: number, volume: number}>}
 */
export function computeLinearCombination(alignedDatasets, weights) {
  if (alignedDatasets.length === 0 || alignedDatasets.length !== weights.length) {
    throw new Error("Datasets and weights mismatch in length");
  }

  const length = alignedDatasets[0].length;
  const synthetic = [];

  for (let i = 0; i < length; i++) {
    // All datasets have the same time at index `i` because they are aligned
    const time = alignedDatasets[0][i].time;
    
    let sumO = 0, sumH = 0, sumL = 0, sumC = 0, sumVol = 0;

    for (let j = 0; j < alignedDatasets.length; j++) {
      const point = alignedDatasets[j][i];
      const weight = weights[j];

      sumO += point.open * weight;
      sumH += point.high * weight;
      sumL += point.low * weight;
      sumC += point.close * weight;
      
      // Volume cannot be negative. Short positions still contribute to absolute trading volume intensity.
      sumVol += point.volume * Math.abs(weight);
    }

    // Since weights can be negative, the standard relationship Open < High and Open > Low can be inverted.
    // For a standard candlestick, High must strictly be >= Low, and Open/Close must be between them.
    // So we need to re-evaluate the actual High and Low of the resulting synthetic bar.
    const actualHigh = Math.max(sumO, sumH, sumL, sumC);
    const actualLow = Math.min(sumO, sumH, sumL, sumC);

    synthetic.push({
      time,
      open: sumO,
      high: actualHigh,
      low: actualLow,
      close: sumC,
      volume: sumVol
    });
  }

  return synthetic;
}
