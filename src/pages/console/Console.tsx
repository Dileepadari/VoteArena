/** The host console: the question list, and what is currently open. */

import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Link2,
  ListPlus,
  MonitorPlay,
  Settings2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { SessionDTO, TallyDTO } from "../../../shared/types";
import { Brand } from "../../components/Brand";
import { JoinCode } from "../../components/JoinCode";
import { QRCode } from "../../components/QRCode";
import { ConnectionBadge } from "../../components/Status";
import { useToast } from "../../lib/toast";
import { ApiError, api, forgetAdminToken, getAdminToken } from "../../lib/api";
import { useLiveSession } from "../../lib/live";
import { copyText, joinUrl, shareOrCopy, wallUrl } from "../../lib/urls";
import styles from "./Console.module.css";
import { NewQuestion } from "./NewQuestion";
import { QuestionEditor } from "./QuestionEditor";
import { SessionSettings } from "./SessionSettings";

export function Console() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const adminToken = getAdminToken(code);

  const live = useLiveSession(code);
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [adminTallies, setAdminTallies] = useState<Record<string, TallyDTO>>({});
  const [viewers, setViewers] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [denied, setDenied] = useState(false);

  /**
   * The console needs the admin view: draft questions, and true counts even when
   * results are hidden from the audience. The live channel still drives the
   * refresh, so a change made on another device shows up here immediately.
   */
  const refresh = useCallback(async () => {
    if (!adminToken) return;
    try {
      const state = await api.getAdminSession(code, adminToken);
      setSession(state.session);
      setViewers(state.viewers);
      setAdminTallies(Object.fromEntries(state.tallies.map((t) => [t.questionId, t])));
      setDenied(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setDenied(true);
      else if (err instanceof ApiError && err.status === 404) setDenied(true);
    }
  }, [code, adminToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A `session` frame means the shape changed; a `tally` frame only changes
  // numbers, which are merged below without a round trip.
  const publicRevision = live.session
    ? `${live.session.questions.map((q) => `${q.id}:${q.status}:${q.options.length}`).join("|")}:${live.session.status}:${live.session.title}`
    : "";
  useEffect(() => {
    if (publicRevision) void refresh();
  }, [publicRevision, refresh]);

  const tallies = useMemo(() => {
    const merged = { ...adminTallies };
    for (const [id, tally] of Object.entries(live.tallies)) {
      const current = merged[id];
      // Prefer the admin copy when the audience copy has been redacted to zeros.
      if (!current || tally.revision > current.revision) merged[id] = tally;
      if (current && tally.totalVotes === 0 && current.totalVotes > 0 && tally.totalBallots === current.totalBallots) {
        merged[id] = current;
      }
    }
    return merged;
  }, [adminTallies, live.tallies]);

  const questions = session?.questions ?? [];
  const selected =
    questions.find((q) => q.id === selectedId) ??
    questions.find((q) => q.status === "open") ??
    questions[0] ??
    null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  /* -------------------------------------------------------------- actions */

  const mutate = useCallback(
    async <T,>(action: () => Promise<T>, successMessage?: string): Promise<T | null> => {
      try {
        const result = await action();
        await refresh();
        if (successMessage) toast(successMessage, "good");
        return result;
      } catch (err) {
        toast(err instanceof ApiError ? err.message : "That did not work.", "bad");
        return null;
      }
    },
    [refresh, toast],
  );

  const renameSession = useCallback(
    async (title: string) => {
      if (!adminToken || !session || title.trim() === session.title || !title.trim()) return;
      await mutate(() => api.updateSession(code, adminToken, { title: title.trim() }));
    },
    [adminToken, session, code, mutate],
  );

  /* --------------------------------------------------------------- gates */

  if (!adminToken || denied) {
    return (
      <Frame>
        <div className={styles.gate}>
          <Brand static size="lg" />
          <h1 className={styles.gateTitle}>You are not the host of this session</h1>
          <p className={styles.gateBody}>
            The host key lives in the browser that created the session. Open the control room from
            that browser, or start a new session here.
          </p>
          <div className={styles.row}>
            <Link to={`/v/${code}`} className="btn">
              <Eye size={16} />
              Join as a voter
            </Link>
            <Link to="/host" className="btn btn--primary">
              Start a session
            </Link>
          </div>
        </div>
      </Frame>
    );
  }

  if (!session) {
    return (
      <Frame>
        <div className={styles.gate}>
          <p className={styles.gateBody}>Loading the control room…</p>
        </div>
      </Frame>
    );
  }

  const openQuestion = questions.find((q) => q.status === "open") ?? null;

  return (
    <Frame>
      <header className={styles.top}>
        <Brand size="sm" />
        <div className={styles.topTitle}>
          <input
            className={styles.titleInput}
            defaultValue={session.title}
            key={session.title}
            onBlur={(event) => void renameSession(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Session name"
            maxLength={120}
          />
          <span className={styles.itemMeta}>
            {viewers} {viewers === 1 ? "screen" : "screens"} connected
          </span>
        </div>

        <div className={styles.topActions}>
          <JoinCode
            code={code}
            size="sm"
            onCopy={() => {
              void copyText(code);
              toast("Join code copied", "good");
            }}
          />
          <button
            className="btn btn--sm"
            onClick={async () => {
              const outcome = await shareOrCopy(session.title, joinUrl(code));
              if (outcome !== "failed") toast(outcome === "shared" ? "Shared" : "Join link copied", "good");
            }}
          >
            <Link2 size={14} />
            Share
          </button>
          <a className="btn btn--sm" href={wallUrl(code)} target="_blank" rel="noreferrer">
            <MonitorPlay size={14} />
            Open wall
            <ExternalLink size={12} />
          </a>
          <button className="btn btn--sm" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 size={14} />
          </button>
          <ConnectionBadge status={live.status} />
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.column}>
          <div className={styles.sectionHead}>
            <h2 className={styles.cardTitle}>Questions</h2>
            {/* The visible label stays short for the sidebar, but the accessible
                name has to distinguish this from the "Add" that adds options to
                a question further down the page. */}
            <button
              className="btn btn--sm btn--primary"
              onClick={() => setCreating(true)}
              aria-label="New question"
            >
              <ListPlus size={14} />
              Add
            </button>
          </div>

          {questions.length === 0 ? (
            <p className={styles.emptyList}>
              No questions yet. Add one, then open it when the room is ready.
            </p>
          ) : (
            <div className={styles.list}>
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className={styles.item}
                  data-selected={question.id === selected?.id}
                  data-status={question.status}
                >
                  <button
                    className={styles.itemSelect}
                    onClick={() => setSelectedId(question.id)}
                  >
                    <span className={styles.itemIndex}>{index + 1}</span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemPrompt}>{question.prompt}</span>
                      <span className={styles.itemMeta}>
                        <span
                          className={`pill pill--${question.status === "open" ? "live" : question.status}`}
                        >
                          {question.status}
                        </span>
                        {question.type === "pool" ? "Open field" : "Fixed answers"}
                        {" · "}
                        {tallies[question.id]?.totalBallots ?? 0} votes
                      </span>
                    </span>
                  </button>

                  <span className={styles.reorder}>
                    <button
                      className={styles.reorderBtn}
                      disabled={index === 0}
                      aria-label={`Move "${question.prompt}" up`}
                      onClick={() =>
                        void mutate(() =>
                          api.updateQuestion(question.id, adminToken, { position: index - 1 }),
                        )
                      }
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      className={styles.reorderBtn}
                      disabled={index === questions.length - 1}
                      aria-label={`Move "${question.prompt}" down`}
                      onClick={() =>
                        void mutate(() =>
                          api.updateQuestion(question.id, adminToken, { position: index + 1 }),
                        )
                      }
                    >
                      <ChevronDown size={12} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <JoinPanel code={code} />

          {showSettings && (
            <SessionSettings
              session={session}
              onToggleStrict={(value) =>
                void mutate(
                  () => api.updateSession(code, adminToken, { strictDeviceCheck: value }),
                  value ? "Strict device check on" : "Strict device check off",
                )
              }
              onEnd={() =>
                void mutate(
                  () => api.updateSession(code, adminToken, { status: "ended" }),
                  "Session ended",
                )
              }
              onReopen={() =>
                void mutate(
                  () => api.updateSession(code, adminToken, { status: "live" }),
                  "Session reopened",
                )
              }
              onDelete={async () => {
                const ok = await mutate(() => api.deleteSession(code, adminToken));
                if (ok !== null) {
                  forgetAdminToken(code);
                  navigate("/", { replace: true });
                }
              }}
            />
          )}
        </div>

        <div className={styles.column}>
          {creating && (
            <NewQuestion
              onCancel={() => setCreating(false)}
              onCreate={async (body) => {
                const created = await mutate(
                  () => api.createQuestion(code, adminToken, body),
                  "Question added",
                );
                if (created) {
                  setSelectedId(created.question.id);
                  setCreating(false);
                }
              }}
            />
          )}

          {selected ? (
            <QuestionEditor
              key={selected.id}
              question={selected}
              tally={tallies[selected.id]}
              adminToken={adminToken}
              otherOpen={openQuestion && openQuestion.id !== selected.id ? openQuestion : null}
              onChanged={refresh}
              mutate={mutate}
            />
          ) : (
            !creating && (
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Nothing selected</h2>
                <p className={styles.gateBody} style={{ textAlign: "left" }}>
                  Add your first question to get going. Fixed answers give you a ranked leaderboard;
                  an open field gives you the bubble view where people can type their own answer.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </Frame>
  );
}

/* ---------------------------------------------------------------- pieces */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="stage-glow" />
      <div className={styles.page}>{children}</div>
    </>
  );
}

function JoinPanel({ code }: { code: string }) {
  const toast = useToast();
  const url = joinUrl(code);

  return (
    <div className={styles.joinPanel}>
      <span className="eyebrow">How people join</span>
      <div className={styles.joinQr}>
        <QRCode value={url} size={132} />
      </div>
      <div className={styles.joinInfo}>
        <JoinCode code={code} size="md" onCopy={() => { void copyText(code); toast("Copied", "good"); }} />
        <span className={styles.joinLink}>{url}</span>
        <button
          className="btn btn--sm"
          onClick={async () => {
            const ok = await copyText(url);
            toast(ok ? "Join link copied" : "Could not copy", ok ? "good" : "bad");
          }}
        >
          <Link2 size={13} />
          Copy join link
        </button>
      </div>
    </div>
  );
}
