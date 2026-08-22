import { Check, Hourglass, Plus, Radio, Search, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { QuestionDTO, TallyDTO } from "../../shared/types";
import { Brand } from "../components/Brand";
import { ConnectionBadge } from "../components/Status";
import { useToast } from "../lib/toast";
import { BubbleField } from "../components/viz/BubbleField";
import { Leaderboard } from "../components/viz/Leaderboard";
import { ApiError, api } from "../lib/api";
import { activeQuestion, useLiveSession } from "../lib/live";
import { resultsRevealed } from "../lib/visibility";
import styles from "./Vote.module.css";

const EMPTY_TALLY: TallyDTO = {
  questionId: "",
  totalBallots: 0,
  totalVotes: 0,
  entries: [],
  revision: 0,
};

export function Vote() {
  const { code = "" } = useParams();
  const toast = useToast();
  const { session, tallies, status, error } = useLiveSession(code);

  /** questionId -> optionIds this device has already committed. */
  const [myBallots, setMyBallots] = useState<Record<string, string[]>>({});
  const [selection, setSelection] = useState<string[]>([]);
  const [writeIn, setWriteIn] = useState("");
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const question = activeQuestion(session);
  const tally = (question && tallies[question.id]) || EMPTY_TALLY;

  // What this device has already answered, so a refresh or a returning voter
  // sees their receipt rather than an empty ballot they can fill in again.
  const refreshMe = useCallback(
    (signal?: AbortSignal) => {
      if (!code) return;
      api
        .me(code, signal)
        .then((state) => setMyBallots(state.ballots))
        .catch(() => {
          /* the vote call itself is the real guard; this is only for display */
        });
    },
    [code],
  );

  useEffect(() => {
    const controller = new AbortController();
    refreshMe(controller.signal);
    return () => controller.abort();
  }, [refreshMe]);

  // A host reset is the only thing that can make a tally shrink. When it does,
  // the receipt on this screen is stale: the ballot was deleted server-side and
  // this device may vote again. Without this, everyone still holding the page
  // open is locked out of a re-run.
  const seenBallotCounts = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!question) return;
    const previous = seenBallotCounts.current[question.id];
    seenBallotCounts.current[question.id] = tally.totalBallots;
    if (previous !== undefined && tally.totalBallots < previous) {
      setMyBallots((prev) => {
        if (!(question.id in prev)) return prev;
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
      refreshMe();
    }
  }, [question, tally.totalBallots, refreshMe]);

  // Moving to a new question clears whatever was half-selected on the last one.
  useEffect(() => {
    setSelection([]);
    setWriteIn("");
    setQuery("");
  }, [question?.id]);

  const myChoice = question ? myBallots[question.id] : undefined;
  const hasVoted = myChoice !== undefined;

  const toggle = useCallback((optionId: string, maxSelections: number) => {
    setSelection((prev) => {
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      if (maxSelections === 1) return [optionId];
      if (prev.length >= maxSelections) return prev;
      return [...prev, optionId];
    });
    setWriteIn("");
  }, []);

  const submit = useCallback(async () => {
    if (!question || submitting) return;
    const trimmed = writeIn.trim();
    if (!selection.length && !trimmed) return;

    setSubmitting(true);
    try {
      const result = await api.vote(question.id, {
        optionIds: selection.length ? selection : undefined,
        writeIns: trimmed ? [trimmed] : undefined,
      });
      setMyBallots((prev) => ({
        ...prev,
        [question.id]: result.selectedOptionIds,
      }));
      setSelection([]);
      setWriteIn("");
      setQuery("");
      toast("Vote counted", "good");
      if (navigator.vibrate) navigator.vibrate(12);
    } catch (err) {
      if (err instanceof ApiError && err.reason === "already_voted") {
        // Another tab, or a retry after a flaky connection, already got there.
        const state = await api.me(code).catch(() => null);
        if (state) setMyBallots(state.ballots);
        toast("You have already voted on this question.", "bad");
      } else {
        toast(
          err instanceof ApiError ? err.message : "Could not send your vote.",
          "bad",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [question, selection, writeIn, submitting, toast, code]);

  /* ------------------------------------------------------------- render */

  if (error) {
    return (
      <Shell code={code} status={status} title={null}>
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>{error}</h2>
          <p className={styles.stateBody}>
            Check the code on screen and try again. Codes are six characters.
          </p>
          <a href="/" className="btn">
            Back to start
          </a>
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell code={code} status={status} title={null}>
        <div className={styles.state}>
          <div className={styles.pulseRing}>
            <Radio size={26} />
          </div>
          <p className={styles.stateBody}>Connecting to the room…</p>
        </div>
      </Shell>
    );
  }

  if (session.status === "ended") {
    return (
      <Shell code={code} status={status} title={session.title}>
        <div className={styles.state}>
          <div className={styles.pulseRing}>
            <Trophy size={26} />
          </div>
          <h2 className={styles.stateTitle}>That is a wrap</h2>
          <p className={styles.stateBody}>
            This session has ended. Thanks for voting.
          </p>
        </div>
      </Shell>
    );
  }

  if (!question) {
    return (
      <Shell code={code} status={status} title={session.title}>
        <div className={styles.state}>
          <div className={styles.pulseRing}>
            <Hourglass size={26} />
          </div>
          <h2 className={styles.stateTitle}>You are in</h2>
          <p className={styles.stateBody}>
            Keep this page open. The first question will appear the moment the
            host opens it.
          </p>
        </div>
      </Shell>
    );
  }

  const isOpen = question.status === "open";
  const showResults = resultsRevealed(question);

  return (
    <Shell code={code} status={status} title={session.title}>
      <div className={styles.body}>
        <header>
          <h1 className={styles.prompt}>{question.prompt}</h1>
          <div className={styles.meta}>
            <span className={`pill ${isOpen ? "pill--live" : "pill--closed"}`}>
              <span className={`dot ${isOpen ? "dot--live" : ""}`} />
              {isOpen ? "Open" : "Closed"}
            </span>
            <span className="pill">
              {tally.totalBallots} {tally.totalBallots === 1 ? "vote" : "votes"}
            </span>
            {question.maxSelections > 1 && (
              <span className="pill">Pick up to {question.maxSelections}</span>
            )}
          </div>
        </header>

        {hasVoted || !isOpen ? (
          <VotedView
            question={question}
            tally={tally}
            myChoice={myChoice}
            showResults={showResults}
            isOpen={isOpen}
          />
        ) : (
          <Ballot
            question={question}
            selection={selection}
            onToggle={toggle}
            query={query}
            setQuery={setQuery}
            writeIn={writeIn}
            setWriteIn={setWriteIn}
          />
        )}
      </div>

      {!hasVoted && isOpen && (
        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <button
              className="btn btn--primary btn--lg btn--block"
              onClick={submit}
              disabled={submitting || (!selection.length && !writeIn.trim())}
            >
              {submitting ? "Sending…" : "Lock in my vote"}
            </button>
            <p className={styles.hint}>
              {selection.length || writeIn.trim()
                ? "You cannot change this once it is in."
                : question.allowWriteIn
                  ? "Pick an answer, or type your own."
                  : "Pick an answer to continue."}
            </p>
          </div>
        </footer>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ shell */

function Shell({
  code,
  status,
  title,
  children,
}: {
  code: string;
  status: ReturnType<typeof useLiveSession>["status"];
  title: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="stage-glow" />
      <div className="grain" />
      <div className={styles.page}>
        <div className={styles.bar}>
          <Brand size="sm" />
          <span className={styles.sessionTitle}>{title ?? code}</span>
          <ConnectionBadge status={status} />
        </div>
        {children}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- ballot */

interface BallotProps {
  question: QuestionDTO;
  selection: string[];
  onToggle: (optionId: string, maxSelections: number) => void;
  query: string;
  setQuery: (value: string) => void;
  writeIn: string;
  setWriteIn: (value: string) => void;
}

function Ballot({
  question,
  selection,
  onToggle,
  query,
  setQuery,
  writeIn,
  setWriteIn,
}: BallotProps) {
  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    if (!trimmedQuery) return question.options;
    const needle = trimmedQuery.toLowerCase();
    return question.options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [question.options, trimmedQuery]);

  // Offer to add the typed text only when it is not already on the list.
  const exactMatch = question.options.some(
    (option) =>
      option.label.trim().toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const canAdd =
    question.allowWriteIn && trimmedQuery.length > 0 && !exactMatch;

  // A long list needs a filter box; a short one is faster to just look at.
  const showSearch = question.allowWriteIn || question.options.length > 8;

  return (
    <div className={styles.options}>
      {showSearch && (
        <div className={styles.searchWrap}>
          <Search size={17} className={styles.searchIcon} />
          <input
            className={`input ${styles.search}`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (writeIn) setWriteIn("");
            }}
            placeholder={
              question.allowWriteIn
                ? "Search, or type your own answer"
                : "Search the options"
            }
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label={
              question.allowWriteIn
                ? "Search or add an answer"
                : "Search the options"
            }
          />
        </div>
      )}

      {canAdd && (
        <button
          type="button"
          className={styles.addRow}
          data-selected={writeIn === trimmedQuery}
          onClick={() =>
            setWriteIn(writeIn === trimmedQuery ? "" : trimmedQuery)
          }
        >
          <span
            className={styles.tick}
            style={writeIn === trimmedQuery ? undefined : undefined}
          >
            {writeIn === trimmedQuery ? (
              <Check size={15} strokeWidth={3} />
            ) : (
              <Plus size={15} />
            )}
          </span>
          <span className={styles.addRowLabel}>Add “{trimmedQuery}”</span>
          <span className={styles.writeInFlag}>New</span>
        </button>
      )}

      {filtered.map((option) => {
        const selected = selection.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={styles.option}
            data-selected={selected}
            aria-pressed={selected}
            onClick={() => onToggle(option.id, question.maxSelections)}
          >
            <span className={styles.tick}>
              {selected && <Check size={15} strokeWidth={3} />}
            </span>
            <span className={styles.optionLabel}>{option.label}</span>
            {option.source === "write_in" && (
              <span className={styles.writeInFlag}>Added</span>
            )}
          </button>
        );
      })}

      {filtered.length === 0 && !canAdd && (
        <p className={styles.noMatch}>
          {question.options.length === 0
            ? "The host has not added any options yet."
            : "Nothing matches that search."}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ voted view */

function VotedView({
  question,
  tally,
  myChoice,
  showResults,
  isOpen,
}: {
  question: QuestionDTO;
  tally: TallyDTO;
  myChoice: string[] | undefined;
  showResults: boolean;
  isOpen: boolean;
}) {
  const labels = (myChoice ?? [])
    .map((id) => question.options.find((option) => option.id === id)?.label)
    .filter(Boolean) as string[];

  return (
    <div className={styles.voted}>
      {myChoice && (
        <div className={styles.receipt}>
          <span className={styles.receiptIcon}>
            <Check size={18} strokeWidth={3} />
          </span>
          <span className={styles.receiptText}>
            <span className={styles.receiptTitle}>Your vote is in</span>
            <span className={styles.receiptChoice}>
              {labels.length ? labels.join(", ") : "Counted"}
            </span>
          </span>
        </div>
      )}

      {!myChoice && !isOpen && (
        <div
          className={styles.receipt}
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
        >
          <span className={styles.receiptText}>
            <span className={styles.receiptTitle}>Voting has closed</span>
            <span className={styles.receiptChoice}>
              Here is how the room answered.
            </span>
          </span>
        </div>
      )}

      <section>
        <div className={styles.resultsHead}>
          <h2 style={{ fontSize: 15 }}>Live results</h2>
          <span className="eyebrow">
            {tally.totalBallots} {tally.totalBallots === 1 ? "voter" : "voters"}
          </span>
        </div>

        {!showResults ? (
          <p className={styles.hiddenNote}>
            Results are hidden until the host closes this question.
          </p>
        ) : question.type === "pool" ? (
          <div className={styles.bubbleBox}>
            <BubbleField entries={tally.entries} highlighted={myChoice ?? []} />
          </div>
        ) : (
          <Leaderboard
            entries={tally.entries}
            totalBallots={tally.totalBallots}
            highlighted={myChoice ?? []}
            isOpen={isOpen}
            maxRows={12}
          />
        )}
      </section>
    </div>
  );
}
