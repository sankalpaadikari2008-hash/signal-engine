from fastapi import FastAPI, WebSocket 
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import time
import random

app = FastAPI()

# Enable CORS (important for Vercel frontend)
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

# WebSocket route
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")

    try:
        while True:
            # Fake signal for testing
            signal = {
                "type": random.choice(["STRONG_BUY", "STRONG_SELL"]),
                "price": 65000 + random.randint(-500, 500),
                "timestamp": int(time.time() * 1000),
                "confidence": random.randint(80, 95)
            }

            await websocket.send_json(signal)
            await asyncio.sleep(5)

    except Exception as e:
        print("Client disconnected", e)
