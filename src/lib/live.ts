/** The EventSource subscription and the merged live state it produces. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionDTO, TallyDTO } from "../../shared/types";
import { api } from "./api";

export type LiveStatus = "connecting" | "live" | "reconnecting" | "gone";

export interface LiveState {
  session: SessionDTO | null;
  tallies: Record<string, TallyDTO>;
  status: LiveStatus;
  /** Set when the session cannot be loaded at all, e.g. a wrong code. */
  error: string | null;
}

/**
 * Subscribes to a session's live channel.
 *
 * EventSource reconnects on its own, so this hook only has to keep the merged
 * state and decide when a dropped connection is worth telling the user about.
 * A brief drop while a phone changes cell tower should not flash a red banner,
 * so `reconnecting` is only surfaced after the first retry fails.
 */
export function useLiveSession(code: string | undefined): LiveState {
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [tallies, setTallies] = useState<Record<string, TallyDTO>>({});
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  // Highest revision seen per question, so an out-of-order frame after a
  // reconnect cannot roll the wall backwards to a stale count.
  const revisions = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let failures = 0;

    // Confirm the session exists before opening a stream, so a mistyped code
    // reports "not found" instead of silently retrying forever.
    const controller = new AbortController();
    api
      .getSession(code, controller.signal)
      .then(({ session: initial }) => {
        if (cancelled) return;
        setSession(initial);
        setError(null);
        connect();
      })
      .catch((err: unknown) => {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        setStatus("gone");
        setError(
          (err as { status?: number })?.status === 404
            ? "No session with that code."
            : "Could not reach the server.",
        );
      });

    function connect(): void {
      if (cancelled) return;
      source = new EventSource(`/api/sessions/${encodeURIComponent(code!)}/stream`);

      source.addEventListener("open", () => {
        failures = 0;
        setStatus("live");
      });

      source.addEventListener("hello", (event) => {
        const data = JSON.parse((event as MessageEvent).data) as {
          session: SessionDTO;
          tallies: TallyDTO[];
        };
        revisions.current = {};
        const next: Record<string, TallyDTO> = {};
        for (const tally of data.tallies) {
          next[tally.questionId] = tally;
          revisions.current[tally.questionId] = tally.revision;
        }
        setSession(data.session);
        setTallies(next);
        setStatus("live");
        setError(null);
      });

      source.addEventListener("session", (event) => {
        const data = JSON.parse((event as MessageEvent).data) as { session: SessionDTO };
        setSession(data.session);
      });

      source.addEventListener("tally", (event) => {
        const tally = JSON.parse((event as MessageEvent).data) as TallyDTO;
        const seen = revisions.current[tally.questionId] ?? -1;
        if (tally.revision < seen) return;
        revisions.current[tally.questionId] = tally.revision;
        setTallies((prev) => ({ ...prev, [tally.questionId]: tally }));
      });

      source.addEventListener("error", () => {
        // readyState CLOSED means EventSource has given up; anything else means
        // it is retrying and will fire "open" again by itself.
        failures += 1;
        if (failures > 1) setStatus("reconnecting");
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          const backoff = Math.min(1000 * 2 ** Math.min(failures, 5), 15_000);
          setTimeout(connect, backoff);
        }
      });
    }

    return () => {
      cancelled = true;
      controller.abort();
      source?.close();
    };
  }, [code]);

  return useMemo(
    () => ({ session, tallies, status, error }),
    [session, tallies, status, error],
  );
}

/** The question the host currently has open, or the last one that was open. */
export function activeQuestion(session: SessionDTO | null) {
  if (!session) return null;
  const open = session.questions.find((q) => q.status === "open");
  if (open) return open;
  if (session.currentQuestionId) {
    return session.questions.find((q) => q.id === session.currentQuestionId) ?? null;
  }
  const closed = [...session.questions].reverse().find((q) => q.status === "closed");
  return closed ?? null;
}
