/** Process entry point: open the database, start listening, shut down cleanly. */

import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDb, getDb } from "./db/index.js";
import { hub } from "./lib/events.js";

const app = createApp();

// Fail at boot rather than on the first vote if the database is unusable.
getDb();

const server = app.listen(config.port, config.host, () => {
  const shown = config.publicUrl ?? `http://localhost:${config.port}`;
  console.log(`VoteArena listening on ${config.host}:${config.port}`);
  console.log(`Join links will point at ${shown}`);
});

// SSE connections hold sockets open indefinitely; close them explicitly or the
// process hangs on shutdown and the orchestrator eventually kills it.
function shutdown(signal: string): void {
  console.log(`\n${signal} received, shutting down.`);
  hub.shutdown();
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
