/** A tiny toast queue, shared by every page through a subscription. */

import { createContext, useContext } from "react";

export type ToastTone = "info" | "good" | "bad";
export type PushToast = (message: string, tone?: ToastTone) => void;

export const ToastContext = createContext<PushToast>(() => {});

/** Shows a transient message. No-ops outside a ToastProvider. */
export function useToast(): PushToast {
  return useContext(ToastContext);
}
