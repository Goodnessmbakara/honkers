// ---------------------------------------------------------------------------
// Express HTTP server setup (COM-1).
// Serves the indexer REST API for the frontend and admin console.
// No private note data is ever exposed through this API (COM-2).
// ---------------------------------------------------------------------------

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "../config.js";
import { marketsRouter } from "./routes/markets.js";
import { resolutionRouter } from "./routes/resolution.js";

export function createServer(): express.Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — allow configured origins (default: Vite dev server)
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ["GET"],
    }),
  );

  // JSON body parsing (for future admin POST endpoints)
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API routes
  app.use("/api/markets", marketsRouter);
  app.use("/api/resolution", resolutionRouter);

  // 404 fallback
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("[api] Unhandled error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}

export function startServer(): void {
  const app = createServer();
  app.listen(config.port, () => {
    console.log(`[api] Indexer API listening on http://localhost:${config.port}`);
  });
}
