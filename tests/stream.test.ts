import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import { closeDb } from "../server/db/index.js";
import { hub } from "../server/lib/events.js";

interface Frame {
  event: string;
  data: any;
}

/** Minimal SSE reader: enough to assert on frames without pulling in a client library. */
async function openStream(url: string, signal: AbortSignal) {
  const res = await fetch(url, { headers: { accept: "text/event-stream" }, signal });
  if (!res.body) throw new Error("no stream body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frames: Frame[] = [];
  const waiters: { match: (f: Frame) => boolean; resolve: (f: Frame) => void }[] = [];

  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const eventLine = chunk.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const frame: Frame = {
            event: eventLine.slice(7).trim(),
            data: JSON.parse(dataLine.slice(6)),
          };
          frames.push(frame);
          for (let i = waiters.length - 1; i >= 0; i -= 1) {
            if (waiters[i].match(frame)) {
              waiters[i].resolve(frame);
              waiters.splice(i, 1);
            }
          }
        }
      }
    } catch {
      /* aborted */
    }
  })();

  return {
    frames,
    /** Resolves with the first frame matching the predicate, past or future. */
    waitFor(match: (f: Frame) => boolean, timeoutMs = 3000): Promise<Frame> {
      const existing = frames.find(match);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`timed out waiting for frame after ${timeoutMs}ms`)),
          timeoutMs,
        );
        waiters.push({
          match,
          resolve: (f) => {
            clearTimeout(timer);
            resolve(f);
          },
        });
      });
    },
  };
}

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  hub.shutdown();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDb();
});

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("live stream", () => {
  it("delivers hello, then state and tally frames as the room votes", async () => {
    const created = await api("/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "Live" }),
    });
    const code: string = created.body.session.code;
    const token: string = created.body.adminToken;
    const admin = { "x-admin-token": token };

    const controller = new AbortController();
    const stream = await openStream(`${base}/api/sessions/${code}/stream`, controller.signal);

    const hello = await stream.waitFor((f) => f.event === "hello");
    expect(hello.data.session.code).toBe(code);
    expect(hello.data.session.questions).toHaveLength(0);

    const q = await api(`/sessions/${code}/questions`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify({ type: "pool", prompt: "Who?", options: ["Ada"] }),
    });
    const questionId: string = q.body.question.id;

    await api(`/questions/${questionId}/open`, { method: "POST", headers: admin, body: "{}" });

    const opened = await stream.waitFor(
      (f) => f.event === "session" && f.data.session.questions.some((x: any) => x.status === "open"),
    );
    expect(opened.data.session.currentQuestionId).toBe(questionId);

    await api(`/questions/${questionId}/vote`, {
      method: "POST",
      body: JSON.stringify({ writeIns: ["Grace"] }),
    });

    const tally = await stream.waitFor(
      (f) => f.event === "tally" && f.data.entries.some((e: any) => e.label === "Grace"),
    );
    expect(tally.data.totalBallots).toBe(1);

    // The new write-in must also reach the wall as an option, not just as a count.
    const withOption = await stream.waitFor(
      (f) =>
        f.event === "session" &&
        f.data.session.questions[0]?.options.some((o: any) => o.label === "Grace"),
    );
    expect(withOption).toBeTruthy();

    controller.abort();
  });

  it("coalesces a burst of votes into far fewer frames than votes", async () => {
    const created = await api("/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "Burst" }),
    });
    const code: string = created.body.session.code;
    const admin = { "x-admin-token": created.body.adminToken as string };

    const q = await api(`/sessions/${code}/questions`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify({ type: "fixed", prompt: "Burst?", options: ["A", "B"] }),
    });
    const questionId: string = q.body.question.id;
    const optionId: string = q.body.question.options[0].id;
    await api(`/questions/${questionId}/open`, { method: "POST", headers: admin, body: "{}" });

    const controller = new AbortController();
    const stream = await openStream(`${base}/api/sessions/${code}/stream`, controller.signal);
    await stream.waitFor((f) => f.event === "hello");

    const VOTES = 40;
    for (let i = 0; i < VOTES; i += 1) {
      await api(`/questions/${questionId}/vote`, {
        method: "POST",
        headers: { "x-device-print": `burst-${i}` },
        body: JSON.stringify({ optionIds: [optionId] }),
      });
    }

    await stream.waitFor((f) => f.event === "tally" && f.data.totalBallots === VOTES, 5000);
    const tallyFrames = stream.frames.filter((f) => f.event === "tally").length;

    expect(tallyFrames).toBeLessThan(VOTES);
    controller.abort();
  });
});
