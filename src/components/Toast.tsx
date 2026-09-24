/** Renders whatever `lib/toast` currently holds. */

import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext, type ToastTone } from "../lib/toast";
import styles from "./Toast.module.css";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const VISIBLE_MS = 4200;
const MAX_STACKED = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-(MAX_STACKED - 1)), { id, message, tone }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, VISIBLE_MS);
    timers.current.add(timer);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
