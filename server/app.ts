/**
 * Express wiring: security headers, compression, body limits, routers and the
 * built SPA. Nothing here knows about voting; it only decides what reaches the
 * routers and on what terms.
 */

import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import express, { type Express } from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./lib/http.js";
import { questionsRouter } from "./routes/questions.js";
import { sessionsRouter } from "./routes/sessions.js";
import { streamRouter } from "./routes/stream.js";

export function createApp(): Express {
  const app = express();

  // Behind a load balancer the client IP arrives in X-Forwarded-For. Trusting a
  // fixed number of hops rather than `true` stops a client spoofing the header.
  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          // React writes element styles as inline attributes for the bubble layout.
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "blob:"],
          "font-src": ["'self'", "data:"],
          "connect-src": ["'self'"],
          "frame-ancestors": ["'none'"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          "upgrade-insecure-requests": config.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      // The results wall is meant to be projected; allow it to be full-screened.
      referrerPolicy: { policy: "same-origin" },
    }),
  );

  app.use(
    compression({
      filter: (req, res) => {
        // Compressing an event stream makes frames sit in the encoder's buffer.
        if (res.getHeader("Content-Type")?.toString().includes("text/event-stream")) return false;
        return compression.filter(req, res);
      },
    }),
  );

  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, version: 1, env: config.env });
  });

  app.use("/api", streamRouter);
  app.use("/api", sessionsRouter);
  app.use("/api", questionsRouter);
  app.use("/api", notFoundHandler);

  mountClient(app);

  app.use(errorHandler);
  return app;
}

/** Serves the built SPA when it exists, with hashed assets cached hard and index.html never cached. */
function mountClient(app: Express): void {
  const indexPath = path.join(config.clientDir, "index.html");
  if (!fs.existsSync(indexPath)) return;

  app.use(
    express.static(config.clientDir, {
      index: false,
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (/\.[0-9a-f]{8,}\.(js|css|woff2?|png|svg|ico)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=3600");
        }
      },
    }),
  );

  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexPath);
  });
}
