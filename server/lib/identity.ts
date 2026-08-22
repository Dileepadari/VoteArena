import crypto from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config.js";
import { newId } from "./ids.js";

export const VOTER_COOKIE = "va_voter";
const VOTER_HEADER = "x-voter-token";
const PRINT_HEADER = "x-device-print";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function hmac(value: string, scope: string): string {
  return crypto.createHmac("sha256", config.secretKey).update(`${scope}:${value}`).digest("base64url");
}

/** `<id>.<signature>` - the signature stops a voter minting fresh identities by hand. */
export function signVoterId(voterId: string): string {
  return `${voterId}.${hmac(voterId, "voter")}`;
}

export function verifyVoterToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const voterId = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  const expected = hmac(voterId, "voter");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return voterId;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

export interface VoterIdentity {
  voterId: string;
  /** True when this request minted the identity, so the client should persist the token. */
  isNew: boolean;
  token: string;
  ipHash: string;
  fpHash: string;
}

/**
 * Resolves who is voting, in this order:
 *   1. the signed httpOnly cookie
 *   2. the same token echoed in a header, for browsers that drop third-party
 *      or partitioned cookies (iOS Lockdown mode, in-app browsers)
 *   3. a freshly minted identity
 *
 * The IP is hashed, never stored raw, and is deliberately NOT used as the primary
 * key: a hall full of people behind one NAT shares a single address, so keying on
 * IP would let the first voter lock everyone else out.
 */
export function resolveVoter(req: Request, res: Response): VoterIdentity {
  const fromCookie = verifyVoterToken(readCookie(req, VOTER_COOKIE));
  const headerToken = req.get(VOTER_HEADER) ?? undefined;
  const fromHeader = verifyVoterToken(headerToken);

  const existing = fromCookie ?? fromHeader;
  const voterId = existing ?? newId("v");
  const token = signVoterId(voterId);

  if (!fromCookie) {
    res.cookie?.(VOTER_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction,
      maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
      path: "/",
    });
  }

  return {
    voterId,
    isNew: !existing,
    token,
    ipHash: hashIp(req.ip ?? ""),
    fpHash: hashPrint(req.get(PRINT_HEADER), req.get("user-agent")),
  };
}

export function hashIp(ip: string): string {
  return hmac(ip.replace(/^::ffff:/, ""), "ip").slice(0, 32);
}

export function hashPrint(print: string | undefined, userAgent: string | undefined): string {
  return hmac(`${print ?? "none"}|${userAgent ?? "none"}`, "print").slice(0, 32);
}

export function hashAdminToken(token: string): string {
  return hmac(token, "admin");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}
