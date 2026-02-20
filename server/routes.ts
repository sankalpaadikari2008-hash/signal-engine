import { Express, Request, Response } from "express";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import { generateSignal } from "./services/signalEngine";

const db = new Database("chat.db");

// Initialize table
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export function registerRoutes(app: Express) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  app.get("/api/history", (req: Request, res: Response) => {
    const messages = db.prepare("SELECT * FROM messages ORDER BY timestamp ASC").all();
    res.json(messages);
  });

  app.get("/api/signal", async (req: Request, res: Response) => {
    try {
      const signal = await generateSignal();
      if (signal) {
        res.json(signal);
      } else {
        res.json({ status: "no_signal" });
      }
    } catch (error) {
      console.error("Signal error:", error);
      res.status(500).json({ error: "Failed to generate signal" });
    }
  });

  app.post("/api/chat", async (req: Request, res: Response) => {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    try {
      // Save user message
      const insert = db.prepare("INSERT INTO messages (role, content) VALUES (?, ?)");
      insert.run("user", message);

      // Get chat history for context
      const historyRows = db.prepare("SELECT role, content FROM messages ORDER BY timestamp ASC").all() as { role: string, content: string }[];
      
      // Construct history for Gemini
      const history = historyRows.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const chat = ai.chats.create({
        model: "gemini-2.5-flash-lite-latest",
        history: history,
      });

      const result = await chat.sendMessage({ message: message });
      const responseText = result.text;

      if (responseText) {
        // Save model response
        insert.run("model", responseText);
        res.json({ role: "model", content: responseText });
      } else {
        res.status(500).json({ error: "Empty response from model" });
      }
    } catch (error) {
      console.error("Error generating response:", error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });
  
  app.post("/api/clear", (req: Request, res: Response) => {
    db.prepare("DELETE FROM messages").run();
    res.json({ success: true });
  });
}
