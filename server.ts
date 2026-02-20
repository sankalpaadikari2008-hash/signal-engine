import express from "express";
import { createServer as createViteServer } from "vite";
import { registerRoutes } from "./server/routes";
import { wsManager } from "./server/services/wsManager";
import { generateSignal } from "./server/services/signalEngine";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware
  app.use(express.json());

  // API Routes
  registerRoutes(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving (if needed, though usually handled by build)
    app.use(express.static("dist"));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Initialize WebSocket Server
  wsManager.init(server);

  // Poll for signals every 60 seconds
  setInterval(async () => {
    try {
      await generateSignal();
    } catch (error) {
      console.error("Error polling for signals:", error);
    }
  }, 60000);
}

startServer();
