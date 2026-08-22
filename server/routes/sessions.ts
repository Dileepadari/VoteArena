import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { ApiError } from "../lib/errors.js";
import { hub } from "../lib/events.js";
import { adminToken, asyncRoute, parseBody } from "../lib/http.js";
import { resolveVoter } from "../lib/identity.js";
import { isValidJoinCode, normalizeJoinCode } from "../lib/ids.js";
import {
  LIMITS,
  assertAdmin,
  createSession,
  deleteSession,
  getSessionDTO,
  getSessionTallies,
  getVoterState,
  requireSessionByCode,
  updateSession,
} from "../store.js";
import { publicSession } from "./serialize.js";

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.isTest ? 10_000 : 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many sessions created. Try later." } },
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.titleMax),
  password: z.string().optional(),
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.titleMax).optional(),
  status: z.enum(["draft", "live", "ended"]).optional(),
  currentQuestionId: z.string().nullable().optional(),
  strictDeviceCheck: z.boolean().optional(),
});

export const sessionsRouter = Router();

/** Resolves `:code` for every route below and rejects codes that cannot exist. */
function lookup(code: string) {
  const normalized = normalizeJoinCode(code);
  if (!isValidJoinCode(normalized)) throw ApiError.notFound("No session with that code.");
  return requireSessionByCode(normalized);
}

sessionsRouter.post(
  "/sessions",
  createLimiter,
  asyncRoute((req, res) => {
    if (!config.allowSessionCreation) {
      throw ApiError.forbidden("Session creation is disabled on this server.");
    }
    const body = parseBody(createSchema, req.body);
    if (config.adminPassword && body.password !== config.adminPassword) {
      throw ApiError.unauthorized("That host password is not correct.");
    }
    const { session, adminToken: token } = createSession(body.title);
    res.status(201).json({ session, adminToken: token });
  }),
);

sessionsRouter.get(
  "/sessions/:code",
  asyncRoute((req, res) => {
    const session = lookup(req.params.code);
    res.json({ session: publicSession(getSessionDTO(session.id)) });
  }),
);

/** Full state including draft questions. Requires the admin token. */
sessionsRouter.get(
  "/sessions/:code/admin",
  asyncRoute((req, res) => {
    const session = lookup(req.params.code);
    assertAdmin(session, adminToken(req));
    res.json({
      session: getSessionDTO(session.id),
      tallies: getSessionTallies(session.id),
      viewers: hub.subscriberCount(session.code),
    });
  }),
);

sessionsRouter.patch(
  "/sessions/:code",
  asyncRoute((req, res) => {
    const session = lookup(req.params.code);
    assertAdmin(session, adminToken(req));
    const patch = parseBody(patchSchema, req.body);
    const updated = updateSession(session.id, patch);
    hub.emit(session.code, "session", { session: publicSession(updated) });
    res.json({ session: updated });
  }),
);

sessionsRouter.delete(
  "/sessions/:code",
  asyncRoute((req, res) => {
    const session = lookup(req.params.code);
    assertAdmin(session, adminToken(req));
    deleteSession(session.id);
    hub.closeChannel(session.code);
    res.status(204).end();
  }),
);

/** Which questions this device has already answered, and with what. */
sessionsRouter.get(
  "/sessions/:code/me",
  asyncRoute((req, res) => {
    const session = lookup(req.params.code);
    const voter = resolveVoter(req, res);
    res.json({ ...getVoterState(session.id, voter.voterId), token: voter.token });
  }),
);

export { lookup as lookupSession };
