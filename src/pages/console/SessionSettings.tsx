/** Session-level settings: title, results visibility, the strict device check. */

import { useState } from "react";
import type { SessionDTO } from "../../../shared/types";
import styles from "./Console.module.css";

export interface SessionSettingsProps {
  session: SessionDTO;
  onToggleStrict: (value: boolean) => void;
  onEnd: () => void;
  onReopen: () => void;
  onDelete: () => void;
}

export function SessionSettings({
  session,
  onToggleStrict,
  onEnd,
  onReopen,
  onDelete,
}: SessionSettingsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Session settings</h2>

      <button className={styles.toggle} onClick={() => onToggleStrict(!session.strictDeviceCheck)}>
        <span className={styles.toggleText}>
          <span className={styles.toggleLabel}>Strict device check</span>
          <span className={styles.toggleHint}>
            Also blocks a second vote from the same device signature on the same network. Catches
            someone clearing their browser, but can wrongly block two identical phones on shared
            Wi-Fi. Leave it off unless you need it.
          </span>
        </span>
        <span
          className={styles.switch}
          data-on={session.strictDeviceCheck}
          role="switch"
          aria-checked={session.strictDeviceCheck}
        />
      </button>

      <div className={styles.row}>
        {session.status === "ended" ? (
          <button className="btn btn--sm" onClick={onReopen}>
            Reopen session
          </button>
        ) : (
          <button className="btn btn--sm" onClick={onEnd}>
            End session
          </button>
        )}

        {confirmDelete ? (
          <>
            <button className="btn btn--sm btn--danger" onClick={onDelete}>
              Delete everything
            </button>
            <button className="btn btn--sm btn--ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn--sm btn--danger" onClick={() => setConfirmDelete(true)}>
            Delete session
          </button>
        )}
      </div>

      <p className={styles.toggleHint}>
        Ending a session stops all voting but keeps the results. Deleting removes the session, its
        questions and every vote.
      </p>
    </div>
  );
}
