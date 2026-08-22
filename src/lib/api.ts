import type {
  CreateSessionResponse,
  OptionDTO,
  QuestionDTO,
  QuestionType,
  ResultsVisibility,
  SessionDTO,
  TallyDTO,
  VoterStateDTO,
} from "../../shared/types";
import { getDevicePrint, getVoterToken, setVoterToken } from "./device";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The machine-readable reason on a 409, e.g. "already_voted". */
  get reason(): string | null {
    const details = this.details as { reason?: string } | undefined;
    return details?.reason ?? null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  adminToken?: string | null;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.adminToken) headers["x-admin-token"] = options.adminToken;

  const voterToken = getVoterToken();
  if (voterToken) headers["x-voter-token"] = voterToken;
  headers["x-device-print"] = getDevicePrint();

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers,
      credentials: "same-origin",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "offline", "Cannot reach the server. Check your connection.");
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const error = (payload as { error?: { code: string; message: string; details?: unknown } })
      ?.error;
    throw new ApiError(
      res.status,
      error?.code ?? "unknown",
      error?.message ?? `Request failed (${res.status}).`,
      error?.details,
    );
  }

  // Any endpoint may hand back a refreshed voter token; keep the mirror current.
  const token = (payload as { token?: unknown } | null)?.token;
  if (typeof token === "string") setVoterToken(token);

  return payload as T;
}

/* ---------------------------------------------------------------- sessions */

export const api = {
  health: () => request<{ ok: boolean }>("/health"),

  createSession: (title: string, password?: string) =>
    request<CreateSessionResponse>("/sessions", {
      method: "POST",
      body: password ? { title, password } : { title },
    }),

  getSession: (code: string, signal?: AbortSignal) =>
    request<{ session: SessionDTO }>(`/sessions/${code}`, { signal }),

  getAdminSession: (code: string, adminToken: string, signal?: AbortSignal) =>
    request<{ session: SessionDTO; tallies: TallyDTO[]; viewers: number }>(
      `/sessions/${code}/admin`,
      { adminToken, signal },
    ),

  updateSession: (
    code: string,
    adminToken: string,
    patch: {
      title?: string;
      status?: "draft" | "live" | "ended";
      currentQuestionId?: string | null;
      strictDeviceCheck?: boolean;
    },
  ) => request<{ session: SessionDTO }>(`/sessions/${code}`, { method: "PATCH", body: patch, adminToken }),

  deleteSession: (code: string, adminToken: string) =>
    request<void>(`/sessions/${code}`, { method: "DELETE", adminToken }),

  me: (code: string, signal?: AbortSignal) =>
    request<VoterStateDTO & { token: string }>(`/sessions/${code}/me`, { signal }),

  /* -------------------------------------------------------------- questions */

  createQuestion: (
    code: string,
    adminToken: string,
    body: {
      type: QuestionType;
      prompt: string;
      allowWriteIn?: boolean;
      maxSelections?: number;
      resultsVisibility?: ResultsVisibility;
      options?: string[];
    },
  ) =>
    request<{ question: QuestionDTO }>(`/sessions/${code}/questions`, {
      method: "POST",
      body,
      adminToken,
    }),

  updateQuestion: (
    id: string,
    adminToken: string,
    patch: {
      prompt?: string;
      allowWriteIn?: boolean;
      maxSelections?: number;
      resultsVisibility?: ResultsVisibility;
      position?: number;
    },
  ) => request<{ question: QuestionDTO }>(`/questions/${id}`, { method: "PATCH", body: patch, adminToken }),

  deleteQuestion: (id: string, adminToken: string) =>
    request<void>(`/questions/${id}`, { method: "DELETE", adminToken }),

  addOptions: (id: string, adminToken: string, labels: string[]) =>
    request<{ created: OptionDTO[]; question: QuestionDTO }>(`/questions/${id}/options`, {
      method: "POST",
      body: { labels },
      adminToken,
    }),

  deleteOption: (optionId: string, adminToken: string) =>
    request<{ question: QuestionDTO }>(`/options/${optionId}`, { method: "DELETE", adminToken }),

  openQuestion: (id: string, adminToken: string) =>
    request<{ question: QuestionDTO }>(`/questions/${id}/open`, { method: "POST", body: {}, adminToken }),

  closeQuestion: (id: string, adminToken: string) =>
    request<{ question: QuestionDTO }>(`/questions/${id}/close`, { method: "POST", body: {}, adminToken }),

  resetQuestion: (id: string, adminToken: string) =>
    request<{ question: QuestionDTO }>(`/questions/${id}/reset`, { method: "POST", body: {}, adminToken }),

  results: (id: string, adminToken?: string | null, signal?: AbortSignal) =>
    request<{ tally: TallyDTO }>(`/questions/${id}/results`, { adminToken, signal }),

  vote: (id: string, body: { optionIds?: string[]; writeIns?: string[] }) =>
    request<{
      ballotId: string;
      selectedOptionIds: string[];
      token: string;
      question: QuestionDTO;
      tally: TallyDTO;
    }>(`/questions/${id}/vote`, { method: "POST", body }),
};

/* ------------------------------------------------------------ admin tokens */

const ADMIN_KEY = "votearena.admin";

type AdminMap = Record<string, { token: string; title: string; createdAt: string }>;

function readAdminMap(): AdminMap {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_KEY) ?? "{}") as AdminMap;
  } catch {
    return {};
  }
}

export function rememberAdminToken(code: string, token: string, title: string): void {
  try {
    const map = readAdminMap();
    map[code] = { token, title, createdAt: new Date().toISOString() };
    localStorage.setItem(ADMIN_KEY, JSON.stringify(map));
  } catch {
    /* nothing we can do; the host will need to keep the link */
  }
}

export function getAdminToken(code: string): string | null {
  return readAdminMap()[code]?.token ?? null;
}

export function forgetAdminToken(code: string): void {
  try {
    const map = readAdminMap();
    delete map[code];
    localStorage.setItem(ADMIN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function listHostedSessions(): { code: string; title: string; createdAt: string }[] {
  return Object.entries(readAdminMap())
    .map(([code, meta]) => ({ code, ...meta }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
