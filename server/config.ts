/**
 * Environment parsing, validated once at boot with zod.
 *
 * Production refuses to start without a real `SECRET_KEY`, because that key
 * signs the voter cookies and hashes the IPs. Development mints a random one
 * per boot, which is why a dev restart logs everybody out.
 */

import crypto from "node:crypto";
import path from "node:path";
import { z } from "zod";

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? fallback : /^(1|true|yes|on)$/i.test(v)));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  HOST: z.string().default("0.0.0.0"),
  /** Absolute or relative path to the SQLite file. ":memory:" is honoured for tests. */
  DATABASE_PATH: z.string().default("data/votearena.db"),
  /** Public origin used to build join links and QR codes, e.g. https://vote.example.com */
  PUBLIC_URL: z.string().url().optional(),
  /** HMAC key for voter tokens and IP hashing. Required in production. */
  SECRET_KEY: z.string().min(16).optional(),
  /** Trusted proxy hops in front of the app (1 behind a single load balancer). */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  ALLOW_SESSION_CREATION: bool(true),
  /** Shared password required to create a session. Empty means anyone may create one. */
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const env = parsed.data;

if (env.NODE_ENV === "production" && !env.SECRET_KEY) {
  throw new Error(
    "SECRET_KEY must be set in production. Generate one with: openssl rand -hex 32",
  );
}

const secretKey =
  env.SECRET_KEY ??
  // Ephemeral key for dev and test runs. Restarting invalidates existing voter cookies,
  // which is fine locally but would silently let people vote twice in production.
  crypto.randomBytes(32).toString("hex");

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  port: env.PORT,
  host: env.HOST,
  databasePath:
    env.DATABASE_PATH === ":memory:" ? ":memory:" : path.resolve(process.cwd(), env.DATABASE_PATH),
  publicUrl: env.PUBLIC_URL?.replace(/\/+$/, ""),
  secretKey,
  trustProxy: env.TRUST_PROXY,
  allowSessionCreation: env.ALLOW_SESSION_CREATION,
  adminPassword: env.ADMIN_PASSWORD?.trim() || null,
  clientDir: path.resolve(process.cwd(), "dist/client"),
} as const;

export type Config = typeof config;
