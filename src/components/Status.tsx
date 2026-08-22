import type { LiveStatus } from "../lib/live";
import styles from "./Status.module.css";

const COPY: Record<LiveStatus, { label: string; tone: string }> = {
  connecting: { label: "Connecting", tone: "wait" },
  live: { label: "Live", tone: "live" },
  reconnecting: { label: "Reconnecting", tone: "warn" },
  gone: { label: "Offline", tone: "bad" },
};

export function ConnectionBadge({ status }: { status: LiveStatus }) {
  const { label, tone } = COPY[status];
  return (
    <span className={`${styles.badge} ${styles[tone]}`} role="status">
      <span className={`dot ${status === "live" ? "dot--live" : ""}`} />
      {label}
    </span>
  );
}
