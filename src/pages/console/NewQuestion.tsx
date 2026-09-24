/** The form for adding a question and its options. */

import { useState } from "react";
import type { QuestionType } from "../../../shared/types";
import styles from "./Console.module.css";
import { parseLabels } from "./labels";

export interface NewQuestionProps {
  onCancel: () => void;
  onCreate: (body: {
    type: QuestionType;
    prompt: string;
    options?: string[];
    allowWriteIn?: boolean;
  }) => void | Promise<void>;
}

const TYPES: { value: QuestionType; title: string; hint: string }[] = [
  {
    value: "fixed",
    title: "Fixed answers",
    hint: "You set the options. Results show as a ranked leaderboard.",
  },
  {
    value: "pool",
    title: "Open field",
    hint: "Seed it with names, and let people add their own. Results show as bubbles.",
  },
];

export function NewQuestion({ onCancel, onCreate }: NewQuestionProps) {
  const [type, setType] = useState<QuestionType>("fixed");
  const [prompt, setPrompt] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);

  const options = parseLabels(optionsText);
  const canSubmit = prompt.trim().length > 0 && (type === "pool" || options.length >= 2);

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    await onCreate({ type, prompt: prompt.trim(), options });
    setBusy(false);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>New question</h2>
        <button className="btn btn--sm btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className={styles.grid2}>
        {TYPES.map((option) => (
          <button
            key={option.value}
            className={styles.toggle}
            data-selected={type === option.value}
            style={
              type === option.value
                ? { borderColor: "#3d4a2a", background: "#10130b" }
                : undefined
            }
            onClick={() => setType(option.value)}
          >
            <span className={styles.toggleText}>
              <span className={styles.toggleLabel}>{option.title}</span>
              <span className={styles.toggleHint}>{option.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="new-prompt">Question</label>
        <input
          id="new-prompt"
          className="input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            type === "pool" ? "Who among us is the funniest?" : "Should we move standup to 10am?"
          }
          maxLength={280}
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="new-options">
          {type === "pool" ? "Starting names (optional)" : "Answers"}
        </label>
        <textarea
          id="new-options"
          className="textarea"
          value={optionsText}
          onChange={(event) => setOptionsText(event.target.value)}
          placeholder={
            type === "pool"
              ? "Paste a list of names.\nOne per line, or comma separated."
              : "Yes\nNo\nAbstain"
          }
          rows={5}
        />
        <span className={styles.toggleHint}>
          {options.length > 0
            ? `${options.length} ${options.length === 1 ? "option" : "options"} detected. One per line, or separated by commas, semicolons or tabs.`
            : type === "pool"
              ? "Leave it empty to start from a blank field and let the room fill it in."
              : "Give at least two answers."}
        </span>
      </div>

      <div className={styles.row}>
        <button className="btn btn--primary" onClick={submit} disabled={!canSubmit || busy}>
          {busy ? "Adding…" : "Add question"}
        </button>
      </div>
    </div>
  );
}
