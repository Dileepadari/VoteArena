import type { Response } from "express";

interface Subscriber {
  id: number;
  res: Response;
}

const KEEPALIVE_MS = 25_000;

/**
 * In-process fan-out for Server-Sent Events, one channel per session code.
 *
 * Tally frames are coalesced: during a burst of votes the wall only needs the
 * latest count, so intermediate frames are dropped rather than queued. That
 * keeps a 300-person room to a few frames a second instead of a few hundred.
 */
export class EventHub {
  private channels = new Map<string, Set<Subscriber>>();
  private pending = new Map<string, Map<string, unknown>>();
  private flushTimers = new Map<string, NodeJS.Timeout>();
  private keepalive: NodeJS.Timeout | null = null;
  private nextId = 1;

  constructor(private readonly coalesceMs = 120) {}

  subscribe(code: string, res: Response): () => void {
    const sub: Subscriber = { id: this.nextId++, res };
    let set = this.channels.get(code);
    if (!set) {
      set = new Set();
      this.channels.set(code, set);
    }
    set.add(sub);
    this.ensureKeepalive();

    return () => {
      const current = this.channels.get(code);
      if (!current) return;
      current.delete(sub);
      if (current.size === 0) {
        this.channels.delete(code);
        this.clearChannel(code);
      }
      if (this.channels.size === 0) this.stopKeepalive();
    };
  }

  subscriberCount(code: string): number {
    return this.channels.get(code)?.size ?? 0;
  }

  /** Send immediately. Use for state changes, which must never be dropped. */
  emit(code: string, event: string, data: unknown): void {
    const set = this.channels.get(code);
    if (!set || set.size === 0) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const sub of set) {
      try {
        sub.res.write(frame);
      } catch {
        set.delete(sub);
      }
    }
  }

  /**
   * Send at most one frame per `coalesceMs` for a given (code, key) pair.
   * The newest payload wins; older ones are discarded unsent.
   */
  emitCoalesced(code: string, event: string, key: string, data: unknown): void {
    if (this.subscriberCount(code) === 0) return;
    let bucket = this.pending.get(code);
    if (!bucket) {
      bucket = new Map();
      this.pending.set(code, bucket);
    }
    bucket.set(`${event}:${key}`, data);

    if (this.flushTimers.has(code)) return;
    const timer = setTimeout(() => {
      this.flushTimers.delete(code);
      const entries = this.pending.get(code);
      this.pending.delete(code);
      if (!entries) return;
      for (const [composite, payload] of entries) {
        const eventName = composite.slice(0, composite.indexOf(":"));
        this.emit(code, eventName, payload);
      }
    }, this.coalesceMs);
    timer.unref?.();
    this.flushTimers.set(code, timer);
  }

  /** Close every stream on a channel, e.g. when the session is deleted. */
  closeChannel(code: string): void {
    const set = this.channels.get(code);
    if (set) {
      for (const sub of set) {
        try {
          sub.res.end();
        } catch {
          /* already gone */
        }
      }
      this.channels.delete(code);
    }
    this.clearChannel(code);
    if (this.channels.size === 0) this.stopKeepalive();
  }

  shutdown(): void {
    for (const code of [...this.channels.keys()]) this.closeChannel(code);
    this.stopKeepalive();
  }

  private clearChannel(code: string): void {
    this.pending.delete(code);
    const timer = this.flushTimers.get(code);
    if (timer) clearTimeout(timer);
    this.flushTimers.delete(code);
  }

  private ensureKeepalive(): void {
    if (this.keepalive) return;
    this.keepalive = setInterval(() => {
      for (const code of this.channels.keys()) {
        this.emit(code, "ping", { t: Date.now() });
      }
    }, KEEPALIVE_MS);
    this.keepalive.unref?.();
  }

  private stopKeepalive(): void {
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
  }
}

export const hub = new EventHub();
