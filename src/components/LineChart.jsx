// src/components/LineChart.jsx
// Lightweight Charts v5 line chart for displaying a close price series.
import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, LineSeries } from 'lightweight-charts';

export default function LineChart({ data, height = 280, color = '#2962ff' }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#787b86',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale:  { borderColor: '#2a2e39' },
      timeScale: { borderColor: '#2a2e39' },
      width: containerRef.current.clientWidth,
      height,
    });

    const line = chart.addSeries(LineSeries, {
      color,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = line;

    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, [height, color]);

  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;
    // Deduplicate by time
    const map = new Map();
    for (const p of data) map.set(p.time, p);
    const sorted = Array.from(map.values()).sort((a, b) => (a.time < b.time ? -1 : 1));
    seriesRef.current.setData(sorted);
    chartRef.current.timeScale().fitContent();
  }, [data]);

  return (
    <div ref={containerRef} className="w-full rounded-lg overflow-hidden"
      style={{ border: '1px solid #2a2e39' }} />
  );
}
