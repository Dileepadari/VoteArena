/** The ranked list view of a tally, for questions with too many answers to bubble. */

import { useMemo } from "react";
import type { TallyEntry } from "../../../shared/types";
import styles from "./Leaderboard.module.css";

const RAMP = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6", "--c7", "--c8"];

/** Colour by the option's fixed slot, so a bar keeps its colour when it
 *  overtakes another and adjacent rows never share one. */
function colorFor(position: number): string {
  return `var(${RAMP[position % RAMP.length]})`;
}

export interface LeaderboardProps {
  entries: TallyEntry[];
  totalBallots: number;
  highlighted?: string[];
  showCounts?: boolean;
  /** Drives the sheen on the leading bar. */
  isOpen?: boolean;
  /** "wall" is sized for a projector, "panel" for the host console and phones. */
  scale?: "wall" | "panel";
  maxRows?: number;
}

export function Leaderboard({
  entries,
  totalBallots,
  highlighted = [],
  showCounts = true,
  isOpen = false,
  scale = "panel",
  maxRows,
}: LeaderboardProps) {
  const highlightSet = useMemo(() => new Set(highlighted), [highlighted]);

  const rowHeight = scale === "wall" ? 84 : 52;
  const gap = scale === "wall" ? 16 : 10;
  const step = rowHeight + gap;

  const shown = maxRows ? entries.slice(0, maxRows) : entries;
  // The bar length is relative to the front-runner, not the total, so a close
  // race still fills the width and reads as a race.
  const leadVotes = Math.max(1, ...entries.map((e) => e.votes));

  if (!entries.length) {
    return (
      <div className={styles.empty}>
        <p>No answers on this question yet.</p>
      </div>
    );
  }

  return (
    <div
      className={styles.root}
      style={{ height: shown.length * step - gap }}
      role="list"
      aria-label="Results"
    >
      {shown.map((entry, index) => {
        const pct = totalBallots > 0 ? Math.round((entry.votes / totalBallots) * 100) : 0;
        const width = showCounts ? (entry.votes / leadVotes) * 100 : 0;
        const color = colorFor(entry.position);
        const isLeader = index === 0 && entry.votes > 0;

        return (
          <div
            key={entry.optionId}
            role="listitem"
            className={`${styles.row} ${isLeader ? styles.leader : ""} ${isOpen ? styles.open : ""}`}
            style={{
              transform: `translateY(${index * step}px)`,
              height: rowHeight,
              gridTemplateColumns: `${scale === "wall" ? 56 : 34}px 1fr auto`,
            }}
          >
            <span
              className={`${styles.rank} numeric`}
              style={{ fontSize: scale === "wall" ? 30 : 17 }}
            >
              {index + 1}
            </span>

            <div className={styles.bar} style={{ height: rowHeight }}>
              <div
                className={styles.fill}
                style={{ width: `${width}%`, background: color }}
                aria-hidden
              />
              <span className={styles.label} style={{ fontSize: scale === "wall" ? 30 : 16 }}>
                {entry.label}
              </span>
              <span
                className={`${styles.labelOverlay} ${styles.label}`}
                style={{
                  fontSize: scale === "wall" ? 30 : 16,
                  clipPath: `inset(0 ${(100 - width).toFixed(2)}% 0 0)`,
                }}
                aria-hidden
              >
                {entry.label}
              </span>
            </div>

            <div className={styles.value} style={{ minWidth: scale === "wall" ? 150 : 84 }}>
              {highlightSet.has(entry.optionId) && (
                <span className={styles.mine} title="Your answer" aria-label="Your answer" />
              )}
              {showCounts ? (
                <>
                  <span
                    className={styles.count}
                    style={{ fontSize: scale === "wall" ? 42 : 22, color: isLeader ? color : "var(--fg)" }}
                  >
                    {entry.votes}
                  </span>
                  <span className={styles.pct} style={{ fontSize: scale === "wall" ? 20 : 13 }}>
                    {pct}%
                  </span>
                </>
              ) : (
                <span className={styles.pct} style={{ fontSize: scale === "wall" ? 20 : 13 }}>
                  hidden
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
