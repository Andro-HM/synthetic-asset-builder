// src/components/ChartComponent.jsx
// Uses Lightweight Charts v5 API: chart.addSeries(CandlestickSeries, opts)
import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';

export default function ChartComponent({ candleData, height = 460 }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  // Create chart once on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#787b86',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
    });

    // v5 API: chart.addSeries(SeriesClass, options)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  // Update data whenever candleData changes
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (!candleData || candleData.length === 0) return;

    // Deduplicate by time (keep last), sort ascending
    const dedupedCandles = deduplicate(candleData);

    const volumeData = deduplicate(
      candleData.map(d => ({
        time: d.time,
        value: d.volume ?? 0,
        color: d.close >= d.open ? '#26a69a55' : '#ef535055',
      }))
    );

    candleSeriesRef.current.setData(dedupedCandles);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current.timeScale().fitContent();
  }, [candleData]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ border: '1px solid #2a2e39' }}
    />
  );
}

function deduplicate(data) {
  const map = new Map();
  for (const point of data) {
    map.set(point.time, point);
  }
  return Array.from(map.values()).sort((a, b) => (a.time < b.time ? -1 : 1));
}
