import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpCircle, ArrowDownCircle, Activity } from 'lucide-react';

interface Signal {
  type: "STRONG_BUY" | "STRONG_SELL";
  price: number;
  timestamp: number;
  confidence: number;
}

interface SignalBoxProps {
  signal: Signal | null;
}

export const SignalBox: React.FC<SignalBoxProps> = ({ signal }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          Live Signal
        </h2>
        <span className="text-xs font-mono text-slate-400">
          {signal ? new Date(signal.timestamp).toLocaleTimeString() : '--:--:--'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {signal ? (
          <motion.div
            key={signal.timestamp}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-xl border-2 ${
              signal.type === 'STRONG_BUY'
                ? 'bg-emerald-50 border-emerald-100'
                : 'bg-rose-50 border-rose-100'
            }`}
          >
            <div className="flex items-center gap-4 mb-3">
              {signal.type === 'STRONG_BUY' ? (
                <ArrowUpCircle className="w-10 h-10 text-emerald-600" />
              ) : (
                <ArrowDownCircle className="w-10 h-10 text-rose-600" />
              )}
              <div>
                <h3 className={`text-xl font-bold ${
                  signal.type === 'STRONG_BUY' ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {signal.type.replace('_', ' ')}
                </h3>
                <p className="text-slate-600 font-mono text-sm">
                  @ {signal.price.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Confidence</span>
                <span className="font-medium text-slate-700">{signal.confidence}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${signal.confidence}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full ${
                    signal.type === 'STRONG_BUY' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 text-slate-400"
          >
            <Activity className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">Waiting for signal...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
