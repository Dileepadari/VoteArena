import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import styles from "./Vote.module.css";

export function NotFound() {
  return (
    <>
      <div className="stage-glow" />
      <div className="grain" />
      <div className={styles.page}>
        <div className={styles.bar}>
          <Brand size="sm" />
        </div>
        <div className={styles.state}>
          <h1 className={styles.stateTitle}>Nothing here</h1>
          <p className={styles.stateBody}>
            That link does not point at a session. Check the code, or start from the top.
          </p>
          <Link to="/" className="btn btn--primary">
            Go to VoteArena
          </Link>
        </div>
      </div>
    </>
  );
}
