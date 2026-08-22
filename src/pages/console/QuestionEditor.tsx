import { Play, Plus, RotateCcw, Square, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { QuestionDTO, ResultsVisibility, TallyDTO } from "../../../shared/types";
import { BubbleField } from "../../components/viz/BubbleField";
import { Leaderboard } from "../../components/viz/Leaderboard";
import { api } from "../../lib/api";
import styles from "./Console.module.css";
import { parseLabels } from "./labels";

const EMPTY: TallyDTO = { questionId: "", totalBallots: 0, totalVotes: 0, entries: [], revision: 0 };

const VISIBILITY: { value: ResultsVisibility; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "after_close", label: "On close" },
  { value: "hidden", label: "Never" },
];

export interface QuestionEditorProps {
  question: QuestionDTO;
  tally: TallyDTO | undefined;
  adminToken: string;
  /** Warns the host that opening this one will close whichever is running. */
  otherOpen: QuestionDTO | null;
  onChanged: () => void | Promise<void>;
  mutate: <T>(action: () => Promise<T>, successMessage?: string) => Promise<T | null>;
}

export function QuestionEditor({
  question,
  tally = EMPTY,
  adminToken,
  otherOpen,
  mutate,
}: QuestionEditorProps) {
  const [addText, setAddText] = useState("");
  const [prompt, setPrompt] = useState(question.prompt);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOpen = question.status === "open";
  const pending = parseLabels(addText);
  const writeIns = question.options.filter((option) => option.source === "write_in").length;

  return (
    <>
      <div className={styles.livePanel}>
        <div className={styles.liveHead}>
          <div className={styles.liveCount}>
            <span className={styles.liveCountValue}>{tally.totalBallots}</span>
            <span className={styles.statLabel}>
              {tally.totalBallots === 1 ? "vote in" : "votes in"}
            </span>
          </div>

          <div className={styles.row}>
            {isOpen ? (
              <button
                className="btn btn--sm"
                onClick={() =>
                  void mutate(() => api.closeQuestion(question.id, adminToken), "Voting closed")
                }
              >
                <Square size={13} />
                Close voting
              </button>
            ) : (
              <button
                className="btn btn--sm btn--primary"
                onClick={() =>
                  void mutate(() => api.openQuestion(question.id, adminToken), "Voting is open")
                }
              >
                <Play size={13} />
                {question.status === "closed" ? "Reopen voting" : "Open voting"}
              </button>
            )}

            {confirmReset ? (
              <>
                <button
                  className="btn btn--sm btn--danger"
                  onClick={async () => {
                    await mutate(
                      () => api.resetQuestion(question.id, adminToken),
                      "Votes cleared",
                    );
                    setConfirmReset(false);
                  }}
                >
                  Clear {tally.totalBallots} votes
                </button>
                <button className="btn btn--sm btn--ghost" onClick={() => setConfirmReset(false)}>
                  Keep them
                </button>
              </>
            ) : (
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => setConfirmReset(true)}
                disabled={tally.totalBallots === 0}
                title="Clear every vote on this question"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            )}
          </div>
        </div>

        {otherOpen && !isOpen && (
          <p className={styles.toggleHint}>
            “{otherOpen.prompt}” is open right now. Opening this one closes it.
          </p>
        )}

        <div className={styles.liveBox}>
          {question.type === "pool" ? (
            <BubbleField entries={tally.entries} />
          ) : (
            <div style={{ padding: 16, height: "100%", overflowY: "auto" }}>
              <Leaderboard
                entries={tally.entries}
                totalBallots={tally.totalBallots}
                isOpen={isOpen}
              />
            </div>
          )}
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={`${styles.statValue} numeric`}>{tally.totalBallots}</div>
            <div className={styles.statLabel}>Voters</div>
          </div>
          <div className={styles.stat}>
            <div className={`${styles.statValue} numeric`}>{tally.totalVotes}</div>
            <div className={styles.statLabel}>Selections</div>
          </div>
          <div className={styles.stat}>
            <div className={`${styles.statValue} numeric`}>{question.options.length}</div>
            <div className={styles.statLabel}>Options</div>
          </div>
          <div className={styles.stat}>
            <div className={`${styles.statValue} numeric`}>{writeIns}</div>
            <div className={styles.statLabel}>Added by voters</div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Question setup</h2>
          <span className={`pill pill--${question.status === "open" ? "live" : question.status}`}>
            {question.status}
          </span>
        </div>

        <div className="field">
          <label htmlFor="prompt">Prompt</label>
          <input
            id="prompt"
            className="input"
            value={prompt}
            maxLength={280}
            onChange={(event) => setPrompt(event.target.value)}
            onBlur={() => {
              const clean = prompt.trim();
              if (!clean || clean === question.prompt) {
                setPrompt(question.prompt);
                return;
              }
              void mutate(() => api.updateQuestion(question.id, adminToken, { prompt: clean }));
            }}
          />
        </div>

        <div className={styles.grid2}>
          <div className="field">
            <label>Show results to voters</label>
            <div className={styles.segmented}>
              {VISIBILITY.map((option) => (
                <button
                  key={option.value}
                  className={styles.segment}
                  data-on={question.resultsVisibility === option.value}
                  onClick={() =>
                    void mutate(() =>
                      api.updateQuestion(question.id, adminToken, {
                        resultsVisibility: option.value,
                      }),
                    )
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="max-selections">Answers per person</label>
            <input
              id="max-selections"
              className="input"
              type="number"
              min={1}
              max={20}
              value={question.maxSelections}
              onChange={(event) => {
                const value = Math.max(1, Math.min(20, Number(event.target.value) || 1));
                void mutate(() =>
                  api.updateQuestion(question.id, adminToken, { maxSelections: value }),
                );
              }}
            />
          </div>
        </div>

        <button
          className={styles.toggle}
          onClick={() =>
            void mutate(() =>
              api.updateQuestion(question.id, adminToken, { allowWriteIn: !question.allowWriteIn }),
            )
          }
        >
          <span className={styles.toggleText}>
            <span className={styles.toggleLabel}>Let people type their own answer</span>
            <span className={styles.toggleHint}>
              New answers join the field live. Matching spellings merge automatically.
            </span>
          </span>
          <span className={styles.switch} data-on={question.allowWriteIn} role="switch" aria-checked={question.allowWriteIn} />
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>
            Options <span className={styles.statLabel}>({question.options.length})</span>
          </h2>
        </div>

        {question.options.length > 0 && (
          <div className={styles.chips}>
            {question.options.map((option) => (
              <span
                key={option.id}
                className={`${styles.chip} ${option.source === "write_in" ? styles.chipWriteIn : ""}`}
                title={option.source === "write_in" ? "Added by a voter" : undefined}
              >
                <span className={styles.chipLabel}>{option.label}</span>
                <button
                  className={styles.chipRemove}
                  onClick={() =>
                    void mutate(
                      () => api.deleteOption(option.id, adminToken),
                      `Removed “${option.label}”`,
                    )
                  }
                  aria-label={`Remove ${option.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="field">
          <label htmlFor="add-options">Add options</label>
          <textarea
            id="add-options"
            className="textarea"
            value={addText}
            rows={3}
            placeholder="Paste names or answers. One per line, or comma separated."
            onChange={(event) => setAddText(event.target.value)}
          />
        </div>

        <div className={styles.row}>
          <button
            className="btn btn--sm btn--primary"
            aria-label="Add options"
            disabled={pending.length === 0}
            onClick={async () => {
              const created = await mutate(
                () => api.addOptions(question.id, adminToken, pending),
                `Added ${pending.length} ${pending.length === 1 ? "option" : "options"}`,
              );
              if (created) setAddText("");
            }}
          >
            <Plus size={14} />
            {pending.length > 0 ? `Add ${pending.length}` : "Add"}
          </button>
          {addText && (
            <button className="btn btn--sm btn--ghost" onClick={() => setAddText("")}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className={`${styles.card} ${styles.danger}`}>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle}>Delete this question</h2>
            <p className={styles.toggleHint}>
              Removes the question and every vote on it. This cannot be undone.
            </p>
          </div>
          {confirmDelete ? (
            <div className={styles.row}>
              <button
                className="btn btn--sm btn--danger"
                onClick={() =>
                  void mutate(
                    () => api.deleteQuestion(question.id, adminToken),
                    "Question deleted",
                  )
                }
              >
                Delete for good
              </button>
              <button className="btn btn--sm btn--ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn btn--sm btn--danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      </div>
    </>
  );
}
