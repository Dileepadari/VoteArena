import type {
  OptionDTO,
  OptionSource,
  QuestionDTO,
  QuestionStatus,
  QuestionType,
  ResultsVisibility,
  SessionDTO,
  SessionStatus,
  TallyDTO,
  VoterStateDTO,
} from "../shared/types.js";
import { getDb } from "./db/index.js";
import { ApiError } from "./lib/errors.js";
import { hashAdminToken, safeEqual } from "./lib/identity.js";
import { newId, newJoinCode, newToken, normalizeLabel, nowIso } from "./lib/ids.js";

/* ---------------------------------------------------------------- row types */

interface SessionRow {
  id: string;
  code: string;
  title: string;
  status: SessionStatus;
  admin_token_hash: string;
  current_question_id: string | null;
  strict_device_check: 0 | 1;
  created_at: string;
  updated_at: string;
}

interface QuestionRow {
  id: string;
  session_id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  status: QuestionStatus;
  allow_write_in: 0 | 1;
  max_selections: number;
  results_visibility: ResultsVisibility;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}

interface OptionRow {
  id: string;
  question_id: string;
  label: string;
  normalized_label: string;
  position: number;
  source: OptionSource;
  created_at: string;
}

/* ------------------------------------------------------------------ limits */

export const LIMITS = {
  titleMax: 120,
  promptMax: 280,
  labelMax: 80,
  optionsPerQuestion: 400,
  questionsPerSession: 100,
  maxSelections: 20,
} as const;

/**
 * Bumped on every write that changes a tally. The wall uses it to discard frames
 * that arrive out of order, which SSE reconnects make possible.
 */
const revisions = new Map<string, number>();

/**
 * Seeded from the ballot count so a server restart does not rewind the counter
 * below what connected clients have already seen. Clients also reset their
 * high-water mark on `hello`, which covers the remaining edge cases.
 */
function currentRevision(questionId: string): number {
  const cached = revisions.get(questionId);
  if (cached !== undefined) return cached;
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM ballots WHERE question_id = ?`)
    .get(questionId) as { n: number };
  revisions.set(questionId, row.n);
  return row.n;
}

function bumpRevision(questionId: string): number {
  const next = currentRevision(questionId) + 1;
  revisions.set(questionId, next);
  return next;
}

/* ---------------------------------------------------------------- mappers */

function toOptionDTO(row: OptionRow): OptionDTO {
  return { id: row.id, label: row.label, position: row.position, source: row.source };
}

function toQuestionDTO(row: QuestionRow, options: OptionRow[]): QuestionDTO {
  return {
    id: row.id,
    sessionId: row.session_id,
    position: row.position,
    type: row.type,
    prompt: row.prompt,
    status: row.status,
    allowWriteIn: row.allow_write_in === 1,
    maxSelections: row.max_selections,
    resultsVisibility: row.results_visibility,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    options: options.map(toOptionDTO),
  };
}

/* --------------------------------------------------------------- sessions */

export function createSession(title: string): { session: SessionDTO; adminToken: string } {
  const db = getDb();
  const adminToken = newToken();
  const id = newId("s");
  const ts = nowIso();

  // A collision is vanishingly unlikely, but a duplicate code would hand one
  // audience another room's questions, so retry rather than trust the odds.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newJoinCode();
    try {
      db.prepare(
        `INSERT INTO sessions (id, code, title, status, admin_token_hash, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
      ).run(id, code, title, hashAdminToken(adminToken), ts, ts);
      return { session: getSessionDTO(id), adminToken };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new ApiError(503, "code_exhausted", "Could not allocate a free join code. Try again.");
}

export function findSessionByCode(code: string): SessionRow | null {
  return (getDb()
    .prepare(`SELECT * FROM sessions WHERE code = ?`)
    .get(code) as SessionRow | undefined) ?? null;
}

export function requireSessionByCode(code: string): SessionRow {
  const row = findSessionByCode(code);
  if (!row) throw ApiError.notFound("No session with that code.");
  return row;
}

export function requireSessionById(id: string): SessionRow {
  const row = getDb().prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as
    | SessionRow
    | undefined;
  if (!row) throw ApiError.notFound("Session not found.");
  return row;
}

export function assertAdmin(session: SessionRow, token: string | undefined): void {
  if (!token) throw ApiError.unauthorized();
  if (!safeEqual(hashAdminToken(token), session.admin_token_hash)) throw ApiError.unauthorized();
}

export function getSessionDTO(sessionId: string): SessionDTO {
  const db = getDb();
  const session = requireSessionById(sessionId);
  const questions = db
    .prepare(`SELECT * FROM questions WHERE session_id = ? ORDER BY position ASC`)
    .all(sessionId) as QuestionRow[];
  const options = db
    .prepare(
      `SELECT o.* FROM options o
       JOIN questions q ON q.id = o.question_id
       WHERE q.session_id = ?
       ORDER BY o.position ASC`,
    )
    .all(sessionId) as OptionRow[];

  const byQuestion = new Map<string, OptionRow[]>();
  for (const opt of options) {
    const list = byQuestion.get(opt.question_id);
    if (list) list.push(opt);
    else byQuestion.set(opt.question_id, [opt]);
  }

  return {
    id: session.id,
    code: session.code,
    title: session.title,
    status: session.status,
    currentQuestionId: session.current_question_id,
    strictDeviceCheck: session.strict_device_check === 1,
    createdAt: session.created_at,
    questions: questions.map((q) => toQuestionDTO(q, byQuestion.get(q.id) ?? [])),
  };
}

export interface SessionPatch {
  title?: string;
  status?: SessionStatus;
  currentQuestionId?: string | null;
  strictDeviceCheck?: boolean;
}

export function updateSession(sessionId: string, patch: SessionPatch): SessionDTO {
  const db = getDb();
  const session = requireSessionById(sessionId);

  if (patch.currentQuestionId) {
    const owned = db
      .prepare(`SELECT id FROM questions WHERE id = ? AND session_id = ?`)
      .get(patch.currentQuestionId, sessionId);
    if (!owned) throw ApiError.badRequest("That question is not part of this session.");
  }

  db.prepare(
    `UPDATE sessions
        SET title = COALESCE(?, title),
            status = COALESCE(?, status),
            current_question_id = CASE WHEN ? THEN ? ELSE current_question_id END,
            strict_device_check = COALESCE(?, strict_device_check),
            updated_at = ?
      WHERE id = ?`,
  ).run(
    patch.title ?? null,
    patch.status ?? null,
    patch.currentQuestionId !== undefined ? 1 : 0,
    patch.currentQuestionId ?? null,
    patch.strictDeviceCheck === undefined ? null : patch.strictDeviceCheck ? 1 : 0,
    nowIso(),
    session.id,
  );

  return getSessionDTO(sessionId);
}

export function deleteSession(sessionId: string): void {
  getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

/* -------------------------------------------------------------- questions */

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  allowWriteIn?: boolean;
  maxSelections?: number;
  resultsVisibility?: ResultsVisibility;
  options?: string[];
}

export function createQuestion(sessionId: string, input: QuestionInput): QuestionDTO {
  const db = getDb();
  requireSessionById(sessionId);

  const count = db
    .prepare(`SELECT COUNT(*) AS n FROM questions WHERE session_id = ?`)
    .get(sessionId) as { n: number };
  if (count.n >= LIMITS.questionsPerSession) {
    throw ApiError.badRequest(`A session holds at most ${LIMITS.questionsPerSession} questions.`);
  }

  const id = newId("q");
  const ts = nowIso();
  const position =
    ((db.prepare(`SELECT MAX(position) AS p FROM questions WHERE session_id = ?`).get(sessionId) as {
      p: number | null;
    }).p ?? -1) + 1;

  // A pool question is defined by people adding to it, so write-ins default on.
  const allowWriteIn = input.allowWriteIn ?? input.type === "pool";

  db.transaction(() => {
    db.prepare(
      `INSERT INTO questions
         (id, session_id, position, type, prompt, status, allow_write_in,
          max_selections, results_visibility, created_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    ).run(
      id,
      sessionId,
      position,
      input.type,
      input.prompt,
      allowWriteIn ? 1 : 0,
      input.maxSelections ?? 1,
      input.resultsVisibility ?? "live",
      ts,
    );
    if (input.options?.length) insertOptions(id, input.options, "seed");
  })();

  return getQuestionDTO(id);
}

export function findQuestion(id: string): QuestionRow | null {
  return (getDb().prepare(`SELECT * FROM questions WHERE id = ?`).get(id) as
    | QuestionRow
    | undefined) ?? null;
}

export function requireQuestion(id: string): QuestionRow {
  const row = findQuestion(id);
  if (!row) throw ApiError.notFound("Question not found.");
  return row;
}

export function getQuestionDTO(id: string): QuestionDTO {
  const row = requireQuestion(id);
  const options = getDb()
    .prepare(`SELECT * FROM options WHERE question_id = ? ORDER BY position ASC`)
    .all(id) as OptionRow[];
  return toQuestionDTO(row, options);
}

export interface QuestionPatch {
  prompt?: string;
  allowWriteIn?: boolean;
  maxSelections?: number;
  resultsVisibility?: ResultsVisibility;
  position?: number;
}

export function updateQuestion(id: string, patch: QuestionPatch): QuestionDTO {
  const db = getDb();
  const question = requireQuestion(id);

  if (patch.maxSelections !== undefined && patch.maxSelections > LIMITS.maxSelections) {
    throw ApiError.badRequest(`maxSelections cannot exceed ${LIMITS.maxSelections}.`);
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE questions
          SET prompt = COALESCE(?, prompt),
              allow_write_in = COALESCE(?, allow_write_in),
              max_selections = COALESCE(?, max_selections),
              results_visibility = COALESCE(?, results_visibility)
        WHERE id = ?`,
    ).run(
      patch.prompt ?? null,
      patch.allowWriteIn === undefined ? null : patch.allowWriteIn ? 1 : 0,
      patch.maxSelections ?? null,
      patch.resultsVisibility ?? null,
      id,
    );
    if (patch.position !== undefined && patch.position !== question.position) {
      moveQuestion(question, patch.position);
    }
  })();

  return getQuestionDTO(id);
}

function moveQuestion(question: QuestionRow, target: number): void {
  const db = getDb();
  const siblings = db
    .prepare(`SELECT id FROM questions WHERE session_id = ? ORDER BY position ASC`)
    .all(question.session_id) as { id: string }[];
  const ids = siblings.map((s) => s.id).filter((sid) => sid !== question.id);
  const clamped = Math.max(0, Math.min(target, ids.length));
  ids.splice(clamped, 0, question.id);
  const stmt = db.prepare(`UPDATE questions SET position = ? WHERE id = ?`);
  ids.forEach((sid, index) => stmt.run(index, sid));
}

export function deleteQuestion(id: string): void {
  const db = getDb();
  const question = requireQuestion(id);
  db.transaction(() => {
    db.prepare(`UPDATE sessions SET current_question_id = NULL WHERE current_question_id = ?`).run(
      id,
    );
    db.prepare(`DELETE FROM questions WHERE id = ?`).run(id);
    const remaining = db
      .prepare(`SELECT id FROM questions WHERE session_id = ? ORDER BY position ASC`)
      .all(question.session_id) as { id: string }[];
    const stmt = db.prepare(`UPDATE questions SET position = ? WHERE id = ?`);
    remaining.forEach((row, index) => stmt.run(index, row.id));
  })();
  revisions.delete(id);
}

export function setQuestionStatus(id: string, status: "open" | "closed"): QuestionDTO {
  const db = getDb();
  const question = requireQuestion(id);
  const ts = nowIso();

  db.transaction(() => {
    if (status === "open") {
      // Only one question can take votes at a time, otherwise the wall and the
      // phones disagree about what the room is answering.
      db.prepare(
        `UPDATE questions SET status = 'closed', closed_at = ?
          WHERE session_id = ? AND status = 'open' AND id != ?`,
      ).run(ts, question.session_id, id);
      db.prepare(
        `UPDATE questions SET status = 'open', opened_at = ?, closed_at = NULL WHERE id = ?`,
      ).run(ts, id);
      db.prepare(
        `UPDATE sessions SET current_question_id = ?, status = 'live', updated_at = ? WHERE id = ?`,
      ).run(id, ts, question.session_id);
    } else {
      db.prepare(`UPDATE questions SET status = 'closed', closed_at = ? WHERE id = ?`).run(ts, id);
      db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(ts, question.session_id);
    }
  })();

  bumpRevision(id);
  return getQuestionDTO(id);
}

/** Wipes every ballot for a question so it can be re-run. */
export function resetQuestion(id: string): QuestionDTO {
  const db = getDb();
  requireQuestion(id);
  db.transaction(() => {
    db.prepare(`DELETE FROM ballots WHERE question_id = ?`).run(id);
    // Write-ins only exist because somebody voted for them; clearing the votes
    // clears them too, while seeded options survive the reset.
    db.prepare(`DELETE FROM options WHERE question_id = ? AND source = 'write_in'`).run(id);
  })();
  bumpRevision(id);
  return getQuestionDTO(id);
}

/* ---------------------------------------------------------------- options */

function insertOptions(questionId: string, labels: string[], source: OptionSource): OptionDTO[] {
  const db = getDb();
  const existing = db
    .prepare(`SELECT normalized_label FROM options WHERE question_id = ?`)
    .all(questionId) as { normalized_label: string }[];
  const seen = new Set(existing.map((row) => row.normalized_label));

  const total = db.prepare(`SELECT COUNT(*) AS n FROM options WHERE question_id = ?`).get(
    questionId,
  ) as { n: number };
  let count = total.n;

  let position =
    ((db.prepare(`SELECT MAX(position) AS p FROM options WHERE question_id = ?`).get(questionId) as {
      p: number | null;
    }).p ?? -1) + 1;

  const stmt = db.prepare(
    `INSERT INTO options (id, question_id, label, normalized_label, position, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const ts = nowIso();
  const created: OptionDTO[] = [];

  for (const raw of labels) {
    const label = raw.trim().slice(0, LIMITS.labelMax);
    if (!label) continue;
    const normalized = normalizeLabel(label);
    if (!normalized || seen.has(normalized)) continue;
    if (count >= LIMITS.optionsPerQuestion) {
      throw ApiError.badRequest(
        `A question holds at most ${LIMITS.optionsPerQuestion} options.`,
      );
    }
    const id = newId("o");
    stmt.run(id, questionId, label, normalized, position, source, ts);
    seen.add(normalized);
    created.push({ id, label, position, source });
    position += 1;
    count += 1;
  }

  return created;
}

export function addOptions(questionId: string, labels: string[]): OptionDTO[] {
  const db = getDb();
  requireQuestion(questionId);
  return db.transaction(() => insertOptions(questionId, labels, "seed"))();
}

export function deleteOption(optionId: string): QuestionDTO {
  const db = getDb();
  const option = db.prepare(`SELECT * FROM options WHERE id = ?`).get(optionId) as
    | OptionRow
    | undefined;
  if (!option) throw ApiError.notFound("Option not found.");
  db.prepare(`DELETE FROM options WHERE id = ?`).run(optionId);
  bumpRevision(option.question_id);
  return getQuestionDTO(option.question_id);
}

/* --------------------------------------------------------------- tallying */

export function getTally(questionId: string): TallyDTO {
  const db = getDb();
  const entries = db
    .prepare(
      `SELECT o.id AS optionId, o.label AS label, o.source AS source,
              o.position AS position, COUNT(vc.ballot_id) AS votes
         FROM options o
         LEFT JOIN vote_choices vc ON vc.option_id = o.id
        WHERE o.question_id = ?
        GROUP BY o.id
        ORDER BY votes DESC, o.position ASC`,
    )
    .all(questionId) as {
    optionId: string;
    label: string;
    source: OptionSource;
    position: number;
    votes: number;
  }[];

  const totals = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM ballots WHERE question_id = ?) AS ballots,
              (SELECT COUNT(*) FROM vote_choices vc
                 JOIN ballots b ON b.id = vc.ballot_id
                WHERE b.question_id = ?) AS votes`,
    )
    .get(questionId, questionId) as { ballots: number; votes: number };

  return {
    questionId,
    totalBallots: totals.ballots,
    totalVotes: totals.votes,
    entries,
    revision: currentRevision(questionId),
  };
}

export function getSessionTallies(sessionId: string): TallyDTO[] {
  const questions = getDb()
    .prepare(`SELECT id FROM questions WHERE session_id = ? ORDER BY position ASC`)
    .all(sessionId) as { id: string }[];
  return questions.map((q) => getTally(q.id));
}

/* ---------------------------------------------------------------- ballots */

export interface CastBallotInput {
  questionId: string;
  voterId: string;
  ipHash: string;
  fpHash: string;
  optionIds: string[];
  writeIns: string[];
}

export interface CastBallotResult {
  ballotId: string;
  selectedOptionIds: string[];
  createdOptions: OptionDTO[];
}

export function castBallot(input: CastBallotInput): CastBallotResult {
  const db = getDb();

  return db.transaction(() => {
    const question = requireQuestion(input.questionId);
    if (question.status !== "open") {
      throw ApiError.conflict("question_not_open", "Voting on this question is not open.");
    }
    const session = requireSessionById(question.session_id);
    if (session.status === "ended") {
      throw ApiError.conflict("session_ended", "This session has ended.");
    }

    const already = db
      .prepare(`SELECT id FROM ballots WHERE question_id = ? AND voter_id = ?`)
      .get(input.questionId, input.voterId);
    if (already) {
      throw ApiError.conflict("already_voted", "You have already voted on this question.");
    }

    if (session.strict_device_check === 1) {
      const clash = db
        .prepare(
          `SELECT id FROM ballots WHERE question_id = ? AND fp_hash = ? AND ip_hash = ?`,
        )
        .get(input.questionId, input.fpHash, input.ipHash);
      if (clash) {
        throw ApiError.conflict(
          "device_already_voted",
          "A vote has already been cast from this device.",
        );
      }
    }

    const selected = new Set<string>();
    const createdOptions: OptionDTO[] = [];

    if (input.optionIds.length) {
      const placeholders = input.optionIds.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT id FROM options WHERE question_id = ? AND id IN (${placeholders})`)
        .all(input.questionId, ...input.optionIds) as { id: string }[];
      if (rows.length !== new Set(input.optionIds).size) {
        throw ApiError.badRequest("One or more options do not belong to this question.");
      }
      for (const row of rows) selected.add(row.id);
    }

    if (input.writeIns.length) {
      if (question.allow_write_in !== 1) {
        throw ApiError.forbidden("This question does not accept typed answers.");
      }
      for (const raw of input.writeIns) {
        const label = raw.trim().slice(0, LIMITS.labelMax);
        const normalized = normalizeLabel(label);
        if (!normalized) throw ApiError.badRequest("A typed answer cannot be blank.");

        // Match an existing option first so "Dileep" and "dileep " land on one bubble.
        const match = db
          .prepare(`SELECT id FROM options WHERE question_id = ? AND normalized_label = ?`)
          .get(input.questionId, normalized) as { id: string } | undefined;
        if (match) {
          selected.add(match.id);
        } else {
          const [created] = insertOptions(input.questionId, [label], "write_in");
          if (!created) throw ApiError.badRequest("That answer could not be added.");
          selected.add(created.id);
          createdOptions.push(created);
        }
      }
    }

    if (selected.size === 0) throw ApiError.badRequest("Pick at least one answer.");
    if (selected.size > question.max_selections) {
      throw ApiError.badRequest(
        question.max_selections === 1
          ? "This question takes a single answer."
          : `Pick at most ${question.max_selections} answers.`,
      );
    }

    const ballotId = newId("b");
    try {
      db.prepare(
        `INSERT INTO ballots (id, question_id, voter_id, ip_hash, fp_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(ballotId, input.questionId, input.voterId, input.ipHash, input.fpHash, nowIso());
    } catch (err) {
      // Two requests from the same device raced; the UNIQUE index is the arbiter.
      if (isUniqueViolation(err)) {
        throw ApiError.conflict("already_voted", "You have already voted on this question.");
      }
      throw err;
    }

    const choiceStmt = db.prepare(
      `INSERT INTO vote_choices (ballot_id, option_id) VALUES (?, ?)`,
    );
    for (const optionId of selected) choiceStmt.run(ballotId, optionId);

    bumpRevision(input.questionId);
    return { ballotId, selectedOptionIds: [...selected], createdOptions };
  })();
}

export function getVoterState(sessionId: string, voterId: string): VoterStateDTO {
  const rows = getDb()
    .prepare(
      `SELECT b.question_id AS questionId, vc.option_id AS optionId
         FROM ballots b
         JOIN questions q ON q.id = b.question_id
         LEFT JOIN vote_choices vc ON vc.ballot_id = b.id
        WHERE q.session_id = ? AND b.voter_id = ?`,
    )
    .all(sessionId, voterId) as { questionId: string; optionId: string | null }[];

  const ballots: Record<string, string[]> = {};
  for (const row of rows) {
    const list = (ballots[row.questionId] ??= []);
    if (row.optionId) list.push(row.optionId);
  }
  return { voterId, ballots };
}

/* ----------------------------------------------------------------- helpers */

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("SQLITE_CONSTRAINT")
  );
}
