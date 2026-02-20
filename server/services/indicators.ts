import { RSI, MACD, ATR } from 'technicalindicators';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  rsi: number[];
  macd: { MACD: number; signal: number; histogram: number }[];
  aroon: { up: number; down: number }[];
  smi: number[];
  atr: number[];
}

export function calculateIndicators(candles: Candle[]): Indicators {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // RSI (14)
  const rsi = RSI.calculate({ values: closes, period: 14 });

  // MACD (12, 26, 9)
  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const macd = macdResult.map(m => ({
    MACD: m.MACD || 0,
    signal: m.signal || 0,
    histogram: m.histogram || 0
  }));

  // Aroon (14) - Implemented manually
  const aroon = calculateAroon(highs, lows, 14);

  // ATR (14)
  const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  // SMI (13, 25, 2)
  const smi = calculateSMI(highs, lows, closes, 13, 25, 2);

  return { rsi, macd, aroon, smi, atr };
}

function calculateAroon(highs: number[], lows: number[], period: number): { up: number; down: number }[] {
  const results: { up: number; down: number }[] = [];
  
  if (highs.length < period) return [];

  for (let i = 0; i < highs.length; i++) {
    if (i < period) {
      // Not enough data yet
      // We can push nulls or just skip. Usually indicators align with end.
      // Let's push 0s or handle alignment.
      // Standard behavior: result length = input length - period + 1?
      // Or result length = input length (padded).
      // Let's pad with 0s for simplicity in alignment later (though we use getVal with offset).
      results.push({ up: 0, down: 0 });
      continue;
    }

    const sliceHigh = highs.slice(i - period, i + 1); // period+1 items? No, lookback is period.
    // Aroon calculation usually looks back 'period' days.
    // So slice should be length 'period + 1'?
    // Formula: ((period - days since high) / period) * 100
    // If period is 14, we look at last 14 days + current day? Or just last 14?
    // Usually it's last N periods including current.
    
    const sliceHighs = highs.slice(i - period, i + 1);
    const sliceLows = lows.slice(i - period, i + 1);
    
    // Find index of max high in slice (relative to end of slice)
    // sliceHighs has length period + 1.
    // Index 0 is i-period. Index period is i.
    
    let maxHigh = -Infinity;
    let maxHighIdx = -1;
    let minLow = Infinity;
    let minLowIdx = -1;
    
    for (let j = 0; j < sliceHighs.length; j++) {
      if (sliceHighs[j] > maxHigh) {
        maxHigh = sliceHighs[j];
        maxHighIdx = j;
      }
      if (sliceLows[j] < minLow) {
        minLow = sliceLows[j];
        minLowIdx = j;
      }
    }
    
    // Days since high = (period) - maxHighIdx
    // If maxHigh is at index 'period' (current day), days since = 0.
    // Aroon Up = ((period - daysSince) / period) * 100
    
    const daysSinceHigh = period - maxHighIdx;
    const daysSinceLow = period - minLowIdx;
    
    const up = ((period - daysSinceHigh) / period) * 100;
    const down = ((period - daysSinceLow) / period) * 100;
    
    results[i] = { up, down };
  }
  
  return results;
}

function calculateSMI(highs: number[], lows: number[], closes: number[], q: number, r: number, s: number): number[] {
  const smiValues: number[] = [];
  
  if (closes.length < q + r + s) return [];

  const calculateEMA = (values: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const ema = [values[0]];
    for (let i = 1; i < values.length; i++) {
      ema.push(values[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  };

  const D: number[] = [];
  const Range: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < q - 1) {
      D.push(0);
      Range.push(0);
      continue;
    }
    
    const sliceHigh = highs.slice(i - q + 1, i + 1);
    const sliceLow = lows.slice(i - q + 1, i + 1);
    const hh = Math.max(...sliceHigh);
    const ll = Math.min(...sliceLow);
    const midpoint = (hh + ll) / 2;
    
    D.push(closes[i] - midpoint);
    Range.push(hh - ll);
  }

  const ema1_D = calculateEMA(D.slice(q-1), r);
  const ema1_Range = calculateEMA(Range.slice(q-1), r);

  const ema2_D = calculateEMA(ema1_D, s);
  const ema2_Range = calculateEMA(ema1_Range, s);

  // Pad result to match input length
  // The first valid SMI value corresponds to index (q-1) + (r-1)? No, EMA starts immediately.
  // But D starts at q-1.
  // So ema1_D starts corresponding to index q-1.
  // ema2_D starts corresponding to index q-1.
  // So smiValues[0] corresponds to closes[q-1].
  
  // We need to pad the beginning with (q-1) zeros.
  for (let i = 0; i < q - 1; i++) {
    smiValues.push(0);
  }

  for (let i = 0; i < ema2_D.length; i++) {
    const num = ema2_D[i];
    const den = 0.5 * ema2_Range[i];
    
    if (den === 0) {
      smiValues.push(0);
    } else {
      smiValues.push(100 * (num / den));
    }
  }
  
  return smiValues;
}
