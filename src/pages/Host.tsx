import { KeyRound, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ApiError, api, rememberAdminToken } from "../lib/api";
import styles from "./Host.module.css";

export function Host() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError("Give the session a name.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { session, adminToken } = await api.createSession(clean, password || undefined);
      // The token is the only proof of ownership; losing it locks the host out.
      rememberAdminToken(session.code, adminToken, session.title);
      navigate(`/c/${session.code}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNeedsPassword(true);
        setError("This server needs a host password.");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not create the session.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="stage-glow" />
      <div className="grain" />
      <div className={styles.page}>
        <nav className={styles.nav}>
          <Brand size="md" />
        </nav>

        <main className={styles.main}>
          <div className={styles.card}>
            <div>
              <h1 className={styles.title}>Start a session</h1>
              <p className={styles.lede}>
                You get a six-character join code, a QR to project, and a control room to run the
                questions from.
              </p>
            </div>

            <form className={styles.form} onSubmit={submit}>
              <div className="field">
                <label htmlFor="title">Session name</label>
                <input
                  id="title"
                  className="input"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setError("");
                  }}
                  placeholder="Friday team awards"
                  maxLength={120}
                  autoFocus
                />
              </div>

              {needsPassword && (
                <div className="field">
                  <label htmlFor="password">Host password</label>
                  <input
                    id="password"
                    className="input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Set by whoever runs this server"
                  />
                </div>
              )}

              {error && <p className={styles.error}>{error}</p>}

              <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
                <Sparkles size={17} />
                {busy ? "Creating…" : "Create session"}
              </button>
            </form>

            <p className={styles.note}>
              <KeyRound size={16} className={styles.noteIcon} />
              <span>
                Your host key is stored in this browser. Keep the control-room link, or bookmark it -
                open it from another browser and you will be a spectator, not the host.
              </span>
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
