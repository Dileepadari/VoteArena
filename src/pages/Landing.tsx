/** The front door: create a session, or join one by code. */

import { ArrowRight, MonitorPlay } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { listHostedSessions } from "../lib/api";
import styles from "./Landing.module.css";

const CODE_LENGTH = 6;
const ALLOWED = /[^23456789ABCDEFGHJKMNPQRSTVWXYZ]/g;

export function Landing() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const hosted = listHostedSessions();

  // A QR or link may carry the code as a query param; jump straight through.
  useEffect(() => {
    const incoming = params.get("code");
    if (incoming) {
      const clean = incoming.toUpperCase().replace(ALLOWED, "").slice(0, CODE_LENGTH);
      if (clean.length === CODE_LENGTH) navigate(`/v/${clean}`, { replace: true });
    }
  }, [params, navigate]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError(`A join code is ${CODE_LENGTH} characters.`);
      return;
    }
    navigate(`/v/${code}`);
  }

  return (
    <>
      <div className="stage-glow" />
      <div className="grain" />
      <div className={styles.page}>
        <nav className={styles.nav}>
          <Brand static size="md" />
          <Link to="/host" className="btn btn--sm">
            <MonitorPlay size={15} />
            Host a vote
          </Link>
        </nav>

        <main className={styles.main}>
          <div className={styles.hero}>
            <div>
              <h1 className={styles.title}>
                The room <em>decides</em>.
              </h1>
              <p className={styles.lede} style={{ marginTop: 16 }}>
                Ask a question, put the code on screen, and watch the answers land live. No sign-up,
                no app, one vote each.
              </p>
            </div>

            <form className={styles.joinCard} onSubmit={submit}>
              <label htmlFor="join-code" className="eyebrow">
                Enter the join code
              </label>
              <input
                id="join-code"
                className={styles.codeInput}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase().replace(ALLOWED, "").slice(0, CODE_LENGTH));
                  setError("");
                }}
                placeholder="••••••"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={CODE_LENGTH}
                aria-describedby="join-error"
              />
              <p id="join-error" className={styles.error}>
                {error}
              </p>
              <button
                type="submit"
                className="btn btn--primary btn--lg btn--block"
                disabled={code.length !== CODE_LENGTH}
              >
                Join the vote
                <ArrowRight size={18} />
              </button>
            </form>

            {hosted.length > 0 && (
              <>
                <div className={styles.divider}>Your sessions</div>
                <div className={styles.recent}>
                  {hosted.slice(0, 4).map((session) => (
                    <Link key={session.code} to={`/c/${session.code}`} className={styles.recentRow}>
                      <span className={styles.recentTitle}>{session.title}</span>
                      <span className="pill">{session.code}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>

        <footer className={styles.footer}>Votes are anonymous. One vote per person, per question.</footer>
      </div>
    </>
  );
}
