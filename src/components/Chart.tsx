import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries } from 'lightweight-charts';

interface ChartProps {
  data: any[];
  markers: any[];
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
}

export const Chart: React.FC<ChartProps> = ({ data, markers, timeframe, onTimeframeChange }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: '#334155',
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    seriesRef.current = candlestickSeries;
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0 && seriesRef.current.setData) {
      // Sort data by time to ensure ascending order
      const sortedData = [...data].sort((a, b) => (a.time as number) - (b.time as number));
      seriesRef.current.setData(sortedData);
    }
  }, [data]);

  useEffect(() => {
    if (seriesRef.current && seriesRef.current.setMarkers) {
      // Sort markers by time
      const sortedMarkers = [...markers].sort((a, b) => (a.time as number) - (b.time as number));
      seriesRef.current.setMarkers(sortedMarkers);
    }
  }, [markers]);

  return (
    <div className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">BTC/USDT</h3>
        <div className="flex gap-2">
          {['1m', '5m', '15m', '1h'].map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-[500px]" />
    </div>
  );
};
