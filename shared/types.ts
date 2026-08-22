/**
 * DTOs shared by the Express API and the React client.
 * Keep this file free of runtime imports so both bundles can use it.
 */

export type SessionStatus = "draft" | "live" | "ended";
export type QuestionType = "fixed" | "pool";
export type QuestionStatus = "draft" | "open" | "closed";
export type ResultsVisibility = "live" | "after_close" | "hidden";
export type OptionSource = "seed" | "write_in";

export interface OptionDTO {
  id: string;
  label: string;
  position: number;
  source: OptionSource;
}

export interface QuestionDTO {
  id: string;
  sessionId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  status: QuestionStatus;
  allowWriteIn: boolean;
  maxSelections: number;
  resultsVisibility: ResultsVisibility;
  openedAt: string | null;
  closedAt: string | null;
  options: OptionDTO[];
}

export interface SessionDTO {
  id: string;
  code: string;
  title: string;
  status: SessionStatus;
  currentQuestionId: string | null;
  strictDeviceCheck: boolean;
  createdAt: string;
  questions: QuestionDTO[];
}

export interface TallyEntry {
  optionId: string;
  label: string;
  source: OptionSource;
  votes: number;
  /** The option's stable slot in the question. Drives colour, so a bubble keeps
   *  its colour as it overtakes others, and neighbours never share one. */
  position: number;
}

export interface TallyDTO {
  questionId: string;
  totalBallots: number;
  totalVotes: number;
  entries: TallyEntry[];
  /** Serial number that increases on every recount, so clients can drop stale frames. */
  revision: number;
}

/** What the current device has already done in this session. */
export interface VoterStateDTO {
  voterId: string;
  ballots: Record<string, string[]>;
}

export interface CreateSessionResponse {
  session: SessionDTO;
  adminToken: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Server-sent event payloads, keyed by event name. */
export interface LiveEvents {
  hello: { session: SessionDTO; tallies: TallyDTO[] };
  session: { session: SessionDTO };
  tally: TallyDTO;
  ping: { t: number };
}
