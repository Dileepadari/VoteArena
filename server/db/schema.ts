/** VoteArena schema. Applied at boot inside a transaction; every statement is idempotent. */
export const SCHEMA_SQL = `
-- VoteArena schema. Every statement is idempotent, so boot can replay it safely.

CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','ended')),
  admin_token_hash    TEXT NOT NULL,
  current_question_id TEXT,
  strict_device_check INTEGER NOT NULL DEFAULT 0 CHECK (strict_device_check IN (0,1)),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position           INTEGER NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('fixed','pool')),
  prompt             TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  allow_write_in     INTEGER NOT NULL DEFAULT 0 CHECK (allow_write_in IN (0,1)),
  max_selections     INTEGER NOT NULL DEFAULT 1 CHECK (max_selections >= 1),
  results_visibility TEXT NOT NULL DEFAULT 'live'
                     CHECK (results_visibility IN ('live','after_close','hidden')),
  opened_at          TEXT,
  closed_at          TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id, position);

CREATE TABLE IF NOT EXISTS options (
  id               TEXT PRIMARY KEY,
  question_id      TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  -- Case- and space-folded label, so "Ada L." and "ada l."  collapse to one option.
  normalized_label TEXT NOT NULL,
  position         INTEGER NOT NULL,
  source           TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','write_in')),
  created_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_options_unique ON options(question_id, normalized_label);
CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id, position);

-- One row per voter per question. The UNIQUE constraint is what makes voting once-only.
CREATE TABLE IF NOT EXISTS ballots (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  voter_id    TEXT NOT NULL,
  ip_hash     TEXT NOT NULL,
  fp_hash     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (question_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_ballots_question ON ballots(question_id);
CREATE INDEX IF NOT EXISTS idx_ballots_guard ON ballots(question_id, fp_hash, ip_hash);

CREATE TABLE IF NOT EXISTS vote_choices (
  ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  PRIMARY KEY (ballot_id, option_id)
);
CREATE INDEX IF NOT EXISTS idx_vote_choices_option ON vote_choices(option_id);
`;
