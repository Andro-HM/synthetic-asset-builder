// src/hooks/useIndicators.js
// Manages the list of active indicators and their settings.
// Does NOT touch the chart — ChartComponent reads this state and syncs imperatively.

import { useState, useCallback } from 'react';

export const INDICATOR_DEFAULTS = {
  MA:     { type: 'EMA', period: 20, source: 'close', color: '#2962ff', thickness: 2 },
  VWAP:   { color: '#f59e0b', thickness: 1.5 },
  Volume: { upColor: '#26a69a66', downColor: '#ef535066' },
  RSI:    { period: 14, source: 'close', color: '#ab47bc', obLevel: 70, osLevel: 30, obColor: '#ef5350', osColor: '#26a69a' },
  MACD:   { fast: 12, slow: 26, signal: 9, color: '#2962ff', signalColor: '#ff6d00', histUpColor: '#26a69a', histDownColor: '#ef5350' },
};

export const PANE_TYPES = new Set(['Volume', 'RSI', 'MACD']);

let uid = 0;

export function useIndicators() {
  const [indicators, setIndicators] = useState([]);

  const addIndicator = useCallback((type) => {
    setIndicators(prev => [
      ...prev,
      {
        id: `${type}_${++uid}`,
        type,
        settings: { ...INDICATOR_DEFAULTS[type] },
        visible: true,
        isPane: PANE_TYPES.has(type),
      },
    ]);
  }, []);

  const removeIndicator = useCallback((id) => {
    setIndicators(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateSettings = useCallback((id, patch) => {
    setIndicators(prev =>
      prev.map(i => i.id === id ? { ...i, settings: { ...i.settings, ...patch } } : i)
    );
  }, []);

  const toggleVisibility = useCallback((id) => {
    setIndicators(prev =>
      prev.map(i => i.id === id ? { ...i, visible: !i.visible } : i)
    );
  }, []);

  return { indicators, addIndicator, removeIndicator, updateSettings, toggleVisibility };
}
