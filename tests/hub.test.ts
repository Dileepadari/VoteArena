/**
 * The event hub's bookkeeping.
 *
 * A subscriber can leave two ways: the route's `close` handler calls the
 * disposer, or a write throws because the socket has gone. Those used to be
 * different code paths, and only the first cleaned up the channel. A channel
 * that lost every subscriber to socket errors was left behind as an empty Set,
 * holding its pending frames and its flush timer, with the keepalive interval
 * still pinging it every 25 seconds for the life of the process.
 */

import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { EventHub } from "../server/lib/events.js";

interface Internals {
  channels: Map<string, Set<unknown>>;
  pending: Map<string, unknown>;
  flushTimers: Map<string, unknown>;
  keepalive: unknown;
}

const internals = (hub: EventHub) => hub as unknown as Internals;

function res(options: { failWrites?: boolean } = {}) {
  const frames: string[] = [];
  const response = {
    write(frame: string) {
      if (options.failWrites) throw new Error("socket gone");
      frames.push(frame);
      return true;
    },
    end() {},
  } as unknown as Response;
  return { response, frames };
}

describe("EventHub subscriber bookkeeping", () => {
  it("counts subscribers per channel", () => {
    const hub = new EventHub();
    hub.subscribe("AAA", res().response);
    hub.subscribe("AAA", res().response);
    hub.subscribe("BBB", res().response);

    expect(hub.subscriberCount("AAA")).toBe(2);
    expect(hub.subscriberCount("BBB")).toBe(1);
    expect(hub.subscriberCount("CCC")).toBe(0);
    hub.shutdown();
  });

  it("forgets the channel once the last subscriber disposes", () => {
    const hub = new EventHub();
    const dispose = hub.subscribe("AAA", res().response);

    dispose();

    expect(internals(hub).channels.has("AAA")).toBe(false);
    expect(internals(hub).keepalive).toBeNull();
    hub.shutdown();
  });

  it("forgets the channel when the last subscriber dies on a write", () => {
    const hub = new EventHub();
    hub.subscribe("AAA", res({ failWrites: true }).response);

    hub.emit("AAA", "session", { a: 1 });

    expect(hub.subscriberCount("AAA")).toBe(0);
    expect(internals(hub).channels.has("AAA")).toBe(false);
    expect(internals(hub).pending.has("AAA")).toBe(false);
    expect(internals(hub).flushTimers.has("AAA")).toBe(false);
    // Nothing left to ping, so the interval must be gone too.
    expect(internals(hub).keepalive).toBeNull();
    hub.shutdown();
  });

  it("keeps the healthy subscribers when one of several dies", () => {
    const hub = new EventHub();
    const alive = res();
    hub.subscribe("AAA", res({ failWrites: true }).response);
    hub.subscribe("AAA", alive.response);

    hub.emit("AAA", "session", { a: 1 });

    expect(hub.subscriberCount("AAA")).toBe(1);
    expect(internals(hub).channels.has("AAA")).toBe(true);
    expect(alive.frames).toHaveLength(1);
    expect(alive.frames[0]).toContain("event: session");
    hub.shutdown();
  });

  it("coalesces a burst down to the newest frame per key", async () => {
    vi.useFakeTimers();
    const hub = new EventHub(20);
    const sub = res();
    hub.subscribe("AAA", sub.response);

    hub.emitCoalesced("AAA", "tally", "q1", { count: 1 });
    hub.emitCoalesced("AAA", "tally", "q1", { count: 2 });
    hub.emitCoalesced("AAA", "tally", "q1", { count: 3 });
    expect(sub.frames).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(30);

    expect(sub.frames).toHaveLength(1);
    expect(sub.frames[0]).toContain('"count":3');
    hub.shutdown();
    vi.useRealTimers();
  });

  it("closeChannel ends every stream and drops the keepalive", () => {
    const hub = new EventHub();
    const first = res();
    const second = res();
    hub.subscribe("AAA", first.response);
    hub.subscribe("AAA", second.response);

    hub.closeChannel("AAA");

    expect(hub.subscriberCount("AAA")).toBe(0);
    expect(internals(hub).channels.has("AAA")).toBe(false);
    expect(internals(hub).keepalive).toBeNull();
  });
});
