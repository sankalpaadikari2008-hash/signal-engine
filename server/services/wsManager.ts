import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';

interface SignalOutput {
  type: "STRONG_BUY" | "STRONG_SELL";
  price: number;
  timestamp: number;
  confidence: number;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/live' });

    this.wss.on('connection', (ws) => {
      console.log('Client connected to WebSocket');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  public broadcast(message: SignalOutput) {
    if (!this.wss) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const jsonMessage = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonMessage);
      }
    });
  }
}

export const wsManager = new WebSocketManager();
