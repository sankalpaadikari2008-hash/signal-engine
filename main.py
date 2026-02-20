from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import pandas as pd
import numpy as np
from binance import AsyncClient, BinanceSocketManager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

# === Indicator Logic ===
def calculate_rsi(data, period=14):
    delta = data.diff()
    gain = (delta.where(delta > 0, 0)).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

# === WebSocket Route ===
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    client = await AsyncClient.create()
    bm = BinanceSocketManager(client)

    socket = bm.kline_socket(symbol="BTCUSDT", interval="1m")

    closes = []

    async with socket as stream:
        while True:
            res = await stream.recv()
            kline = res['k']

            if kline['x']:  # candle closed
                close_price = float(kline['c'])
                closes.append(close_price)

                if len(closes) > 50:
                    closes.pop(0)

                if len(closes) > 14:
                    df = pd.Series(closes)
                    rsi = calculate_rsi(df).iloc[-1]

                    signal = None

                    if rsi < 30:
                        signal = "STRONG_BUY"
                    elif rsi > 70:
                        signal = "STRONG_SELL"

                    if signal:
                        await websocket.send_json({
                            "type": signal,
                            "price": close_price,
                            "timestamp": int(kline['T']),
                            "confidence": 85
                        })
