/**
 * The SQLite handle and its pragmas.
 *
 * WAL and a busy timeout are what let the write path and the many concurrent
 * readers of a live results wall coexist in one file.
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";
import { SCHEMA_SQL } from "./schema.js";

export type DB = Database.Database;

let instance: DB | null = null;

export function openDatabase(file: string = config.databasePath): DB {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new Database(file);

  // WAL lets the results wall read tallies while voters are still writing ballots.
  if (file !== ":memory:") db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  // A vote burst at the end of a question can collide on the write lock; wait rather than throw.
  db.pragma("busy_timeout = 5000");

  db.exec(SCHEMA_SQL);
  return db;
}

export function getDb(): DB {
  if (!instance) instance = openDatabase();
  return instance;
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}
