import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { ApiError } from "../lib/errors.js";
import { hub } from "../lib/events.js";
import { adminToken, asyncRoute, parseBody } from "../lib/http.js";
import { resolveVoter } from "../lib/identity.js";
import {
  LIMITS,
  addOptions,
  assertAdmin,
  castBallot,
  createQuestion,
  deleteOption,
  deleteQuestion,
  getQuestionDTO,
  getSessionDTO,
  getTally,
  requireQuestion,
  requireSessionById,
  resetQuestion,
  setQuestionStatus,
  updateQuestion,
} from "../store.js";
import { lookupSession } from "./sessions.js";
import { publicSession, redactTally, tallyVisible } from "./serialize.js";

export const questionsRouter = Router();

const labelList = z
  .array(z.string().trim().min(1).max(LIMITS.labelMax))
  .max(LIMITS.optionsPerQuestion);

const createSchema = z.object({
  type: z.enum(["fixed", "pool"]),
  prompt: z.string().trim().min(1).max(LIMITS.promptMax),
  allowWriteIn: z.boolean().optional(),
  maxSelections: z.number().int().min(1).max(LIMITS.maxSelections).optional(),
  resultsVisibility: z.enum(["live", "after_close", "hidden"]).optional(),
  options: labelList.optional(),
});

const patchSchema = z.object({
  prompt: z.string().trim().min(1).max(LIMITS.promptMax).optional(),
  allowWriteIn: z.boolean().optional(),
  maxSelections: z.number().int().min(1).max(LIMITS.maxSelections).optional(),
  resultsVisibility: z.enum(["live", "after_close", "hidden"]).optional(),
  position: z.number().int().min(0).optional(),
});

const voteSchema = z
  .object({
    optionIds: z.array(z.string().min(1)).max(LIMITS.maxSelections).optional(),
    writeIns: z.array(z.string().trim().min(1).max(LIMITS.labelMax)).max(LIMITS.maxSelections)
      .optional(),
  })
  .refine((v) => (v.optionIds?.length ?? 0) + (v.writeIns?.length ?? 0) > 0, {
    message: "Pick at least one answer.",
  });

/**
 * A generous ceiling: it never troubles a real voter, but it stops one script
 * hammering the endpoint. Real duplicate-vote prevention is the UNIQUE index on
 * (question_id, voter_id), not this limiter, because a whole room can share one
 * NAT address and must not be rate-limited as if it were a single person.
 */
const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 100_000 : 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many votes from this network." } },
});

/* ------------------------------------------------------------------ admin */

function adminQuestion(req: import("express").Request) {
  const question = requireQuestion(req.params.id);
  const session = requireSessionById(question.session_id);
  assertAdmin(session, adminToken(req));
  return { question, session };
}

/** Pushes the new public state to every connected wall and phone. */
function broadcastSession(code: string, sessionId: string): void {
  hub.emit(code, "session", { session: publicSession(getSessionDTO(sessionId)) });
}

function broadcastTally(code: string, questionId: string, immediate = false): void {
  const question = getQuestionDTO(questionId);
  const tally = getTally(questionId);
  const payload = tallyVisible(question) ? tally : redactTally(tally);
  if (immediate) hub.emit(code, "tally", payload);
  else hub.emitCoalesced(code, "tally", questionId, payload);
}

questionsRouter.post(
  "/sessions/:code/questions",
  asyncRoute((req, res) => {
    const session = lookupSession(req.params.code);
    assertAdmin(session, adminToken(req));
    const body = parseBody(createSchema, req.body);
    const question = createQuestion(session.id, body);
    broadcastSession(session.code, session.id);
    res.status(201).json({ question });
  }),
);

questionsRouter.patch(
  "/questions/:id",
  asyncRoute((req, res) => {
    const { question, session } = adminQuestion(req);
    const patch = parseBody(patchSchema, req.body);
    const updated = updateQuestion(question.id, patch);
    broadcastSession(session.code, session.id);
    broadcastTally(session.code, question.id, true);
    res.json({ question: updated });
  }),
);

questionsRouter.delete(
  "/questions/:id",
  asyncRoute((req, res) => {
    const { question, session } = adminQuestion(req);
    deleteQuestion(question.id);
    broadcastSession(session.code, session.id);
    res.status(204).end();
  }),
);

questionsRouter.post(
  "/questions/:id/options",
  asyncRoute((req, res) => {
    const { question, session } = adminQuestion(req);
    const body = parseBody(z.object({ labels: labelList.min(1) }), req.body);
    const created = addOptions(question.id, body.labels);
    broadcastSession(session.code, session.id);
    broadcastTally(session.code, question.id, true);
    res.status(201).json({ created, question: getQuestionDTO(question.id) });
  }),
);

questionsRouter.delete(
  "/options/:optionId",
  asyncRoute((req, res) => {
    const { session } = requireOptionSession(req.params.optionId);
    assertAdmin(session, adminToken(req));
    const question = deleteOption(req.params.optionId);
    broadcastSession(session.code, session.id);
    broadcastTally(session.code, question.id, true);
    res.json({ question });
  }),
);

questionsRouter.post(
  "/questions/:id/open",
  asyncRoute((req, res) => {
    const { question, session } = adminQuestion(req);
    if (question.status === "open") {
      res.json({ question: getQuestionDTO(question.id) });
      return;
    }
    const updated = setQuestionStatus(question.id, "open");
    broadcastSession(session.code, session.id);
    broadcastTally(session.code, question.id, true);
    res.json({ question: updated });
  }),
);

questionsRouter.post(
  "/questions/:id/close",
  asyncRoute((req, res) => {
    const { question, session } = adminQuestion(req);
    const updated = setQuestionStatus(question.id, "closed");
    broadcastSession(session.code, session.id);
    broadcastTally(session.code, question.id, true);
    res.json({ question: updated });
  }),
);

questionsRouter.post(
  "/questions/:id/reset",
  asyncRoute((req, res) => {
    const { question, session } = adminQuestion(req);
    const updated = resetQuestion(question.id);
    broadcastSession(session.code, session.id);
    broadcastTally(session.code, question.id, true);
    res.json({ question: updated });
  }),
);

/* ------------------------------------------------------------------ public */

questionsRouter.get(
  "/questions/:id/results",
  asyncRoute((req, res) => {
    const question = getQuestionDTO(req.params.id);
    const session = requireSessionById(question.sessionId);
    const isAdmin = (() => {
      try {
        assertAdmin(session, adminToken(req));
        return true;
      } catch {
        return false;
      }
    })();
    const tally = getTally(question.id);
    res.json({ tally: isAdmin || tallyVisible(question) ? tally : redactTally(tally) });
  }),
);

questionsRouter.post(
  "/questions/:id/vote",
  voteLimiter,
  asyncRoute((req, res) => {
    const question = requireQuestion(req.params.id);
    const session = requireSessionById(question.session_id);
    const body = parseBody(voteSchema, req.body);
    const voter = resolveVoter(req, res);

    const result = castBallot({
      questionId: question.id,
      voterId: voter.voterId,
      ipHash: voter.ipHash,
      fpHash: voter.fpHash,
      optionIds: body.optionIds ?? [],
      writeIns: body.writeIns ?? [],
    });

    const dto = getQuestionDTO(question.id);
    // A new write-in changes the field itself, so the wall needs the option list
    // before the count that references it.
    if (result.createdOptions.length) broadcastSession(session.code, session.id);
    broadcastTally(session.code, question.id);

    res.status(201).json({
      ballotId: result.ballotId,
      selectedOptionIds: result.selectedOptionIds,
      token: voter.token,
      question: dto,
      tally: tallyVisible(dto) ? getTally(question.id) : redactTally(getTally(question.id)),
    });
  }),
);

/* ---------------------------------------------------------------- helpers */

function requireOptionSession(optionId: string) {
  const row = getDb().prepare(`SELECT question_id FROM options WHERE id = ?`).get(optionId) as
    | { question_id: string }
    | undefined;
  if (!row) throw ApiError.notFound("Option not found.");
  const question = requireQuestion(row.question_id);
  return { question, session: requireSessionById(question.session_id) };
}
