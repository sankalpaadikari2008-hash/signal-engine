import React, { useState, useEffect, useRef } from 'react';
import { SignalBox } from './components/SignalBox';
import { Chart } from './components/Chart';
import { Zap } from 'lucide-react';
import { useEffect } from "react";

interface Signal {
  type: "STRONG_BUY" | "STRONG_SELL";
  price: number;
  timestamp: number;
  confidence: number;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function App() {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial chart data
  useEffect(() => {
    const fetchCandles = async () => {
      try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${timeframe}&limit=1000`);
        const data = await response.json();
        const formattedData = data.map((k: any) => ({
          time: k[0] / 1000, // Lightweight charts uses seconds
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));
        setCandles(formattedData);
      } catch (error) {
        console.error('Failed to fetch candles:', error);
      }
    };

    fetchCandles();
    const interval = setInterval(fetchCandles, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [timeframe]);

  // WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = "wss://signal-engine-production-28aa.up.railway.app/ws/live";
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Connected to Signal WebSocket');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const newSignal: Signal = JSON.parse(event.data);
        console.log('Received signal:', newSignal);
        setSignal(newSignal);

        // Add marker to chart
        setMarkers(prev => {
          // Check for duplicates based on timestamp
          const exists = prev.some(m => m.time === newSignal.timestamp / 1000);
          if (exists) return prev;

          return [...prev, {
            time: newSignal.timestamp / 1000,
            position: 'aboveBar',
            color: '#fbbf24', // yellow-400
            shape: 'circle',
            text: 'Signal',
            size: 1,
          }];
        });
      } catch (error) {
        console.error('Error parsing signal:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('Disconnected from Signal WebSocket');
    };

    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Signal<span className="text-indigo-600">Engine</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              System Active
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Chart 
              data={candles} 
              markers={markers} 
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <SignalBox signal={signal} />
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">System Status</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Connection</span>
                  <span className="text-emerald-600 font-medium">Connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pair</span>
                  <span className="text-slate-900 font-medium">BTC/USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Update</span>
                  <span className="text-slate-900 font-medium">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
