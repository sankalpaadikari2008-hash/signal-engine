import { Candle, calculateIndicators } from './indicators';
import axios from 'axios';
import { wsManager } from './wsManager';

interface SignalOutput {
  type: "STRONG_BUY" | "STRONG_SELL";
  price: number;
  timestamp: number;
  confidence: number;
}

let lastSignalTimestamp = 0;
const MIN_CANDLE_GAP = 10; // Minimum candles between signals
let lastCandleTimestamp = 0; // Track the last processed candle to ensure we only signal on close
let candlesProcessedCount = 0; // Track how many candles we've seen since last signal

export async function generateSignal(): Promise<SignalOutput | null> {
  // 1. Fetch candles (Real data from Binance for BTCUSDT 1h for demonstration)
  // In a real production app, this would come from a database or a more robust feed.
  let candles: Candle[] = [];
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100');
    // Binance format: [Open time, Open, High, Low, Close, Volume, Close time, ...]
    candles = response.data.map((k: any) => ({
      timestamp: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch (error) {
    console.error("Failed to fetch candles:", error);
    return null;
  }

  if (candles.length < 50) return null;

  // Use last CLOSED candle (second to last in the array, as the last one is open)
  // Binance returns the current open candle as the last element.
  const lastClosedCandleIndex = candles.length - 2;
  const currentCandle = candles[lastClosedCandleIndex];
  
  // Check if we already processed this candle
  // Actually, the requirement is "Minimum 10 candle gap between signals".
  // We need to track when the last signal was generated in terms of candle timestamp.
  
  if (currentCandle.timestamp <= lastSignalTimestamp) {
      // We already signaled on this candle or a later one (shouldn't happen if we only look at closed)
      // But wait, "Minimum 10 candle gap".
      // This implies we need to wait for 10 *new* candles.
      // Since we are fetching snapshot, we can't easily count "new candles" without persistent state.
      // But we can check the time difference.
      // 1h interval = 3600000 ms.
      // 10 candles = 10 * 3600000 ms.
      const timeSinceLastSignal = currentCandle.timestamp - lastSignalTimestamp;
      const tenCandlesDuration = 10 * 3600000;
      
      if (timeSinceLastSignal < tenCandlesDuration) {
          return null;
      }
  }

  // 2. Calculate Indicators
  const { rsi, macd, aroon, smi, atr } = calculateIndicators(candles);

  // We need to align indicators with candles.
  // Indicators array length might be different due to lookback periods.
  // We need the values corresponding to `lastClosedCandleIndex`.
  // The `calculateIndicators` returns arrays. We need to find the index in those arrays that matches `lastClosedCandleIndex`.
  // Usually technicalindicators library returns result aligned with the end of the input.
  // So the last element of rsi corresponds to the last element of candles.
  // We want the second to last element of the indicators arrays.
  
  const getVal = (arr: any[], offset: number = 0) => {
    if (!arr || arr.length === 0) return null;
    // arr[arr.length - 1] is the open candle's indicator
    // arr[arr.length - 2] is the closed candle's indicator
    const idx = arr.length - 2 - offset;
    if (idx < 0) return null;
    return arr[idx];
  };

  const currentRsi = getVal(rsi);
  const prevRsi = getVal(rsi, 1);
  
  const currentMacd = getVal(macd);
  const prevMacd = getVal(macd, 1); // To check crossing
  
  const currentAroon = getVal(aroon);
  
  const currentSmi = getVal(smi);
  const prevSmi = getVal(smi, 1);
  
  const currentAtr = getVal(atr);
  
  // ATR Average (last 14 ATR values)
  // We need to slice the ATR array ending at current index
  const atrSlice = atr.slice(atr.length - 2 - 14, atr.length - 2);
  const atrAvg = atrSlice.reduce((a, b) => a + b, 0) / atrSlice.length;

  if (!currentRsi || !prevRsi || !currentMacd || !prevMacd || !currentAroon || !currentSmi || !prevSmi || !currentAtr) {
    return null;
  }

  // 3. Apply Rules
  let score = 0;
  let signalType: "STRONG_BUY" | "STRONG_SELL" | null = null;

  // STRONG BUY Logic
  let buyConfirmations = 0;
  
  // 1. RSI < 35 and increasing
  if (currentRsi < 35 && currentRsi > prevRsi) buyConfirmations++;
  
  // 2. MACD line crossing above signal line
  // Cross above: Prev MACD < Prev Signal AND Curr MACD > Curr Signal
  if (prevMacd.MACD <= prevMacd.signal && currentMacd.MACD > currentMacd.signal) buyConfirmations++;
  
  // 3. MACD histogram positive
  if (currentMacd.histogram > 0) buyConfirmations++;
  
  // 4. Aroon up > Aroon down
  if (currentAroon.up > currentAroon.down) buyConfirmations++;
  
  // 5. SMI increasing
  if (currentSmi > prevSmi) buyConfirmations++;
  
  // 6. ATR above recent average (volatility filter)
  if (currentAtr > atrAvg) buyConfirmations++;

  if (buyConfirmations >= 4) {
    signalType = "STRONG_BUY";
    score = buyConfirmations;
  }

  // STRONG SELL Logic (only check if not buy)
  if (!signalType) {
    let sellConfirmations = 0;
    
    // 1. RSI > 65 and decreasing
    if (currentRsi > 65 && currentRsi < prevRsi) sellConfirmations++;
    
    // 2. MACD crossing below signal line
    if (prevMacd.MACD >= prevMacd.signal && currentMacd.MACD < currentMacd.signal) sellConfirmations++;
    
    // 3. MACD histogram negative
    if (currentMacd.histogram < 0) sellConfirmations++;
    
    // 4. Aroon down > Aroon up
    if (currentAroon.down > currentAroon.up) sellConfirmations++;
    
    // 5. SMI decreasing
    if (currentSmi < prevSmi) sellConfirmations++;
    
    // 6. ATR above average
    if (currentAtr > atrAvg) sellConfirmations++;

    if (sellConfirmations >= 4) {
      signalType = "STRONG_SELL";
      score = sellConfirmations;
    }
  }

  if (signalType) {
    lastSignalTimestamp = currentCandle.timestamp;
    const signal = {
      type: signalType,
      price: currentCandle.close,
      timestamp: currentCandle.timestamp,
      confidence: Math.round((score / 6) * 100)
    };
    
    // Broadcast signal
    wsManager.broadcast(signal);
    
    return signal;
  }

  return null;
}
