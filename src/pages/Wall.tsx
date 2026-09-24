/** The projected results wall. Read-only, and sized for a room rather than a desk. */

import { Expand, Shrink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { QuestionDTO, TallyDTO } from "../../shared/types";
import { Brand } from "../components/Brand";
import { JoinCode } from "../components/JoinCode";
import { QRCode } from "../components/QRCode";
import { ConnectionBadge } from "../components/Status";
import { BubbleField } from "../components/viz/BubbleField";
import { Leaderboard } from "../components/viz/Leaderboard";
import { activeQuestion, useLiveSession } from "../lib/live";
import { resultsRevealed } from "../lib/visibility";
import { joinUrl } from "../lib/urls";
import styles from "./Wall.module.css";

const EMPTY: TallyDTO = { questionId: "", totalBallots: 0, totalVotes: 0, entries: [], revision: 0 };

/**
 * The projector view. Read-only, keyboard-free, and designed to be legible from
 * the back of a room: one headline number, one visualisation, and the join
 * details always somewhere on screen so latecomers can still get in.
 */
export function Wall() {
  const { code = "" } = useParams();
  const { session, tallies, status, error } = useLiveSession(code);
  const fullscreen = useFullscreen();

  const question = activeQuestion(session);
  const tally = (question && tallies[question.id]) || EMPTY;
  const url = joinUrl(code);

  // A projected page should never sleep mid-vote.
  useWakeLock(Boolean(session));

  if (error) {
    return (
      <Frame>
        <div className={styles.lobby} style={{ gridTemplateColumns: "1fr", justifyItems: "center" }}>
          <h1 className={styles.lobbyTitle}>{error}</h1>
        </div>
      </Frame>
    );
  }

  if (!session) {
    return (
      <Frame>
        <div className={styles.lobby} style={{ gridTemplateColumns: "1fr", justifyItems: "center" }}>
          <p className={styles.railHint}>Connecting…</p>
        </div>
      </Frame>
    );
  }

  const showLobby = !question || question.status === "draft";

  return (
    <Frame>
      <div className={styles.chrome}>
        <ConnectionBadge status={status} />
        <button
          className="btn btn--sm"
          onClick={fullscreen.toggle}
          title={fullscreen.active ? "Leave full screen" : "Full screen"}
        >
          {fullscreen.active ? <Shrink size={14} /> : <Expand size={14} />}
          {fullscreen.active ? "Exit" : "Full screen"}
        </button>
      </div>

      {showLobby ? (
        <Lobby title={session.title} code={code} url={url} />
      ) : (
        <Active question={question} tally={tally} code={code} url={url} />
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------------ frame */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="stage-glow" />
      <div className="grain" />
      <div className={styles.page}>{children}</div>
    </>
  );
}

/* ------------------------------------------------------------------ lobby */

function Lobby({ title, code, url }: { title: string; code: string; url: string }) {
  return (
    <div className={styles.lobby}>
      <div className={styles.lobbyCopy}>
        <Brand static size="lg" subtitle="Live audience vote" />
        <h1 className={styles.lobbyTitle}>{title}</h1>
        <ol className={styles.lobbySteps}>
          <li className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <span>
              Scan the code, or open <span className={styles.stepStrong}>{hostOf(url)}</span>
            </span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <span>
              Enter the code <span className={styles.stepStrong}>{code}</span>
            </span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <span>Vote. No sign-up, one vote each.</span>
          </li>
        </ol>
        <JoinCode code={code} size="wall" />
      </div>

      <div className={styles.lobbyQr}>
        <div className={styles.qrFrame}>
          <QRCode value={url} size={340} />
          <img src="/logo-mark.png" alt="" className={`${styles.qrMark} logo-mono`} />
        </div>
        <p className={styles.joinUrl}>{url}</p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- active */

function Active({
  question,
  tally,
  code,
  url,
}: {
  question: QuestionDTO;
  tally: TallyDTO;
  code: string;
  url: string;
}) {
  const isOpen = question.status === "open";
  const revealed = resultsRevealed(question);

  return (
    <>
      <header className={styles.head}>
        <h1 className={styles.question}>{question.prompt}</h1>
        <div className={styles.headMeta}>
          {!isOpen && <span className={styles.closedBanner}>Voting closed</span>}
          <div className={styles.counter}>
            <span className={styles.counterValue}>{tally.totalBallots}</span>
            <span className={styles.counterLabel}>
              {tally.totalBallots === 1 ? "vote in" : "votes in"}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.stage}>
        <div className={styles.viz}>
          {!revealed ? (
            <div className={styles.hiddenVeil}>
              <span className={styles.hiddenCount}>{tally.totalBallots}</span>
              <p className={styles.railHint}>
                {isOpen ? "Answers are sealed until voting closes" : "Revealing…"}
              </p>
            </div>
          ) : question.type === "pool" ? (
            <BubbleField entries={tally.entries} showCounts />
          ) : (
            <div className={styles.boardScroll}>
              <Leaderboard
                entries={tally.entries}
                totalBallots={tally.totalBallots}
                isOpen={isOpen}
                scale="wall"
                maxRows={8}
              />
            </div>
          )}
        </div>

        <aside className={styles.rail}>
          <p className={styles.railHint}>Join at {hostOf(url)}</p>
          <div className={styles.railQr}>
            <QRCode value={url} size={150} />
          </div>
          <span className={styles.railCode}>{code}</span>
        </aside>
      </div>

      <div className={styles.footerBar}>
        <Brand static size="sm" />
        <span className={styles.footerNote}>
          {question.type === "pool" ? "Bubble size = share of the vote" : "One vote per person"}
        </span>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- helpers */

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function useFullscreen() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  return { active, toggle };
}

/** Keeps the projector awake. Silently does nothing where unsupported. */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    if (!nav.wakeLock) return;

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = () => {
      nav.wakeLock
        ?.request("screen")
        .then((lock) => {
          if (cancelled) void lock.release();
          else sentinel = lock;
        })
        .catch(() => {});
    };

    acquire();
    // The lock is dropped when the tab is hidden, so re-take it on return.
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
