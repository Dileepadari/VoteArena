import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import { closeDb, getDb } from "../server/db/index.js";
import {
  Voter,
  addQuestion,
  asAdmin,
  closeQuestion,
  createHost,
  openQuestion,
  tallyOf,
  votesFor,
  type Host,
} from "./helpers.js";

let app: Express;

beforeAll(() => {
  app = createApp();
});

afterAll(() => {
  closeDb();
});

beforeEach(() => {
  const db = getDb();
  db.exec("DELETE FROM sessions");
});

describe("health and routing", () => {
  it("reports healthy", async () => {
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body.ok).toBe(true);
  });

  it("404s an unknown api path", async () => {
    await request(app).get("/api/nope").expect(404);
  });
});

describe("sessions", () => {
  it("creates a session with a six-character join code", async () => {
    const host = await createHost(app, "Friday Quiz");
    expect(host.session.title).toBe("Friday Quiz");
    expect(host.session.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(host.session.status).toBe("draft");
    expect(host.adminToken).toBeTruthy();
  });

  it("rejects a blank title", async () => {
    await request(app).post("/api/sessions").send({ title: "   " }).expect(400);
  });

  it("finds a session by lowercase or spaced code", async () => {
    const host = await createHost(app);
    const messy = ` ${host.session.code.toLowerCase().split("").join(" ")} `.replace(/ /g, " ");
    await request(app).get(`/api/sessions/${encodeURIComponent(messy.trim())}`).expect(200);
  });

  it("404s an unknown code without leaking whether it is malformed", async () => {
    await request(app).get("/api/sessions/ZZZZZZ").expect(404);
    await request(app).get("/api/sessions/nope").expect(404);
  });

  it("guards admin state behind the admin token", async () => {
    const host = await createHost(app);
    await request(app).get(`/api/sessions/${host.session.code}/admin`).expect(401);
    await request(app)
      .get(`/api/sessions/${host.session.code}/admin`)
      .set("x-admin-token", "wrong")
      .expect(401);
    await asAdmin(request(app).get(`/api/sessions/${host.session.code}/admin`), host.adminToken)
      .expect(200);
  });

  it("hides draft questions from the public view", async () => {
    const host = await createHost(app);
    const draft = await addQuestion(host, { type: "fixed", prompt: "Secret?", options: ["a", "b"] });
    const pub = await request(app).get(`/api/sessions/${host.session.code}`).expect(200);
    expect(pub.body.session.questions).toHaveLength(0);

    await openQuestion(host, draft.id);
    const after = await request(app).get(`/api/sessions/${host.session.code}`).expect(200);
    expect(after.body.session.questions).toHaveLength(1);
  });
});

describe("fixed questions", () => {
  let host: Host;

  beforeEach(async () => {
    host = await createHost(app);
  });

  it("counts one vote per option", async () => {
    const q = await addQuestion(host, {
      type: "fixed",
      prompt: "Pineapple on pizza?",
      options: ["Yes", "No"],
    });
    await openQuestion(host, q.id);
    const yes = q.options[0].id;
    const no = q.options[1].id;

    await new Voter(app).vote(q.id, { optionIds: [yes] });
    await new Voter(app).vote(q.id, { optionIds: [yes] });
    await new Voter(app).vote(q.id, { optionIds: [no] });

    const tally = await tallyOf(app, q.id);
    expect(tally.totalBallots).toBe(3);
    expect(votesFor(tally, "Yes")).toBe(2);
    expect(votesFor(tally, "No")).toBe(1);
  });

  it("stops the same device voting twice", async () => {
    const q = await addQuestion(host, { type: "fixed", prompt: "Again?", options: ["A", "B"] });
    await openQuestion(host, q.id);
    const voter = new Voter(app);

    await voter.vote(q.id, { optionIds: [q.options[0].id] });
    const second = await voter.vote(q.id, { optionIds: [q.options[1].id] });

    expect(second.status).toBe(409);
    expect(second.body.error.details.reason).toBe("already_voted");
    const tally = await tallyOf(app, q.id);
    expect(tally.totalBallots).toBe(1);
  });

  it("still recognises a voter whose cookies were cleared, via the echoed token", async () => {
    const q = await addQuestion(host, { type: "fixed", prompt: "Token?", options: ["A", "B"] });
    await openQuestion(host, q.id);
    const voter = new Voter(app);
    await voter.vote(q.id, { optionIds: [q.options[0].id] });

    // Keeps the localStorage token but loses the cookie, as an in-app browser would.
    const res = await voter.vote(q.id, { optionIds: [q.options[0].id] });
    expect(res.status).toBe(409);
  });

  it("lets a genuinely different person on the same network vote", async () => {
    const q = await addQuestion(host, { type: "fixed", prompt: "NAT?", options: ["A", "B"] });
    await openQuestion(host, q.id);
    const sharedIp = "198.51.100.7";

    await new Voter(app, "phone-a", sharedIp).vote(q.id, { optionIds: [q.options[0].id] });
    const second = await new Voter(app, "phone-b", sharedIp).vote(q.id, {
      optionIds: [q.options[0].id],
    });

    expect(second.status).toBe(201);
    expect((await tallyOf(app, q.id)).totalBallots).toBe(2);
  });

  it("rejects a vote on a question that is not open", async () => {
    const q = await addQuestion(host, { type: "fixed", prompt: "Closed?", options: ["A", "B"] });
    const draftVote = await new Voter(app).vote(q.id, { optionIds: [q.options[0].id] });
    expect(draftVote.status).toBe(409);

    await openQuestion(host, q.id);
    await closeQuestion(host, q.id);
    const closedVote = await new Voter(app).vote(q.id, { optionIds: [q.options[0].id] });
    expect(closedVote.status).toBe(409);
    expect(closedVote.body.error.details.reason).toBe("question_not_open");
  });

  it("rejects an option belonging to another question", async () => {
    const a = await addQuestion(host, { type: "fixed", prompt: "A?", options: ["A1"] });
    const b = await addQuestion(host, { type: "fixed", prompt: "B?", options: ["B1"] });
    await openQuestion(host, a.id);
    const res = await new Voter(app).vote(a.id, { optionIds: [b.options[0].id] });
    expect(res.status).toBe(400);
  });

  it("enforces maxSelections", async () => {
    const q = await addQuestion(host, {
      type: "fixed",
      prompt: "Pick two",
      options: ["A", "B", "C"],
      maxSelections: 2,
    });
    await openQuestion(host, q.id);

    const tooMany = await new Voter(app).vote(q.id, {
      optionIds: q.options.map((o) => o.id),
    });
    expect(tooMany.status).toBe(400);

    const ok = await new Voter(app).vote(q.id, {
      optionIds: [q.options[0].id, q.options[1].id],
    });
    expect(ok.status).toBe(201);

    const tally = await tallyOf(app, q.id);
    expect(tally.totalBallots).toBe(1);
    expect(tally.totalVotes).toBe(2);
  });

  it("refuses a typed answer when write-ins are off", async () => {
    const q = await addQuestion(host, { type: "fixed", prompt: "No typing", options: ["A"] });
    await openQuestion(host, q.id);
    const res = await new Voter(app).vote(q.id, { writeIns: ["Sneaky"] });
    expect(res.status).toBe(403);
  });

  it("rejects an empty ballot", async () => {
    const q = await addQuestion(host, { type: "fixed", prompt: "Empty", options: ["A"] });
    await openQuestion(host, q.id);
    const res = await new Voter(app).vote(q.id, {});
    expect(res.status).toBe(400);
  });
});

describe("pool questions", () => {
  let host: Host;

  beforeEach(async () => {
    host = await createHost(app);
  });

  it("accepts a typed answer and creates the option", async () => {
    const q = await addQuestion(host, {
      type: "pool",
      prompt: "Who is funniest?",
      options: ["Ada", "Grace"],
    });
    expect(q.allowWriteIn).toBe(true);
    await openQuestion(host, q.id);

    const res = await new Voter(app).vote(q.id, { writeIns: ["Linus"] });
    expect(res.status).toBe(201);

    const tally = await tallyOf(app, q.id);
    expect(votesFor(tally, "Linus")).toBe(1);
    expect(tally.entries.find((e) => e.label === "Linus")?.source).toBe("write_in");
  });

  it("merges typed answers that differ only by case, spacing or accent", async () => {
    const q = await addQuestion(host, { type: "pool", prompt: "Name?", options: [] });
    await openQuestion(host, q.id);

    await new Voter(app).vote(q.id, { writeIns: ["José García"] });
    await new Voter(app).vote(q.id, { writeIns: ["jose garcia"] });
    await new Voter(app).vote(q.id, { writeIns: ["  JOSE   GARCIA  "] });

    const tally = await tallyOf(app, q.id);
    expect(tally.entries).toHaveLength(1);
    expect(tally.entries[0].votes).toBe(3);
    // The first spelling wins the display label.
    expect(tally.entries[0].label).toBe("José García");
  });

  it("merges a typed answer onto an existing seeded option", async () => {
    const q = await addQuestion(host, { type: "pool", prompt: "Name?", options: ["Ada"] });
    await openQuestion(host, q.id);

    await new Voter(app).vote(q.id, { optionIds: [q.options[0].id] });
    await new Voter(app).vote(q.id, { writeIns: ["ada"] });

    const tally = await tallyOf(app, q.id);
    expect(tally.entries).toHaveLength(1);
    expect(tally.entries[0].votes).toBe(2);
    expect(tally.entries[0].source).toBe("seed");
  });

  it("imports a batch of names and dedupes within the batch", async () => {
    const q = await addQuestion(host, { type: "pool", prompt: "Import" });
    const res = await asAdmin(
      request(app).post(`/api/questions/${q.id}/options`),
      host.adminToken,
    )
      .send({ labels: ["Ada", "Grace", "ada", "Grace ", "Linus"] })
      .expect(201);

    expect(res.body.created).toHaveLength(3);
    expect(res.body.question.options.map((o: { label: string }) => o.label)).toEqual([
      "Ada",
      "Grace",
      "Linus",
    ]);
  });

  it("sorts the tally by votes, highest first", async () => {
    const q = await addQuestion(host, {
      type: "pool",
      prompt: "Rank",
      options: ["Low", "High", "Mid"],
    });
    await openQuestion(host, q.id);
    const [low, high, mid] = q.options;

    await new Voter(app).vote(q.id, { optionIds: [high.id] });
    await new Voter(app).vote(q.id, { optionIds: [high.id] });
    await new Voter(app).vote(q.id, { optionIds: [high.id] });
    await new Voter(app).vote(q.id, { optionIds: [mid.id] });
    await new Voter(app).vote(q.id, { optionIds: [mid.id] });
    await new Voter(app).vote(q.id, { optionIds: [low.id] });

    const tally = await tallyOf(app, q.id);
    expect(tally.entries.map((e) => e.label)).toEqual(["High", "Mid", "Low"]);
  });
});

describe("results visibility", () => {
  it("withholds counts until the question closes", async () => {
    const host = await createHost(app);
    const q = await addQuestion(host, {
      type: "fixed",
      prompt: "Suspense",
      options: ["A", "B"],
      resultsVisibility: "after_close",
    });
    await openQuestion(host, q.id);
    await new Voter(app).vote(q.id, { optionIds: [q.options[0].id] });

    const hidden = await tallyOf(app, q.id);
    expect(hidden.totalVotes).toBe(0);
    expect(hidden.entries.every((e) => e.votes === 0)).toBe(true);
    // The number of people who have answered is still public, so the wall can
    // show "12 in" without giving away the split.
    expect(hidden.totalBallots).toBe(1);

    // The host always sees the true numbers.
    const adminView = await asAdmin(
      request(app).get(`/api/questions/${q.id}/results`),
      host.adminToken,
    ).expect(200);
    expect(adminView.body.tally.entries[0].votes).toBe(1);

    await closeQuestion(host, q.id);
    const revealed = await tallyOf(app, q.id);
    expect(revealed.entries[0].votes).toBe(1);
  });
});

describe("host controls", () => {
  let host: Host;

  beforeEach(async () => {
    host = await createHost(app);
  });

  it("opening a question closes whichever one was open", async () => {
    const a = await addQuestion(host, { type: "fixed", prompt: "A", options: ["x"] });
    const b = await addQuestion(host, { type: "fixed", prompt: "B", options: ["y"] });

    await openQuestion(host, a.id);
    await openQuestion(host, b.id);

    const state = await asAdmin(
      request(app).get(`/api/sessions/${host.session.code}/admin`),
      host.adminToken,
    ).expect(200);
    const questions = state.body.session.questions as { id: string; status: string }[];
    expect(questions.find((q) => q.id === a.id)?.status).toBe("closed");
    expect(questions.find((q) => q.id === b.id)?.status).toBe("open");
    expect(state.body.session.currentQuestionId).toBe(b.id);
    expect(state.body.session.status).toBe("live");
  });

  it("resets a question, clearing ballots and typed answers but keeping seeds", async () => {
    const q = await addQuestion(host, { type: "pool", prompt: "Reset", options: ["Seeded"] });
    await openQuestion(host, q.id);
    await new Voter(app).vote(q.id, { writeIns: ["Typed"] });
    expect((await tallyOf(app, q.id)).totalBallots).toBe(1);

    const res = await asAdmin(
      request(app).post(`/api/questions/${q.id}/reset`),
      host.adminToken,
    ).expect(200);

    expect(res.body.question.options.map((o: { label: string }) => o.label)).toEqual(["Seeded"]);
    const tally = await tallyOf(app, q.id);
    expect(tally.totalBallots).toBe(0);

    // And the same device may now vote again.
    const voter = new Voter(app);
    expect((await voter.vote(q.id, { optionIds: [res.body.question.options[0].id] })).status).toBe(
      201,
    );
  });

  it("reorders questions", async () => {
    const a = await addQuestion(host, { type: "fixed", prompt: "First", options: ["x"] });
    const b = await addQuestion(host, { type: "fixed", prompt: "Second", options: ["y"] });
    const c = await addQuestion(host, { type: "fixed", prompt: "Third", options: ["z"] });

    await asAdmin(request(app).patch(`/api/questions/${c.id}`), host.adminToken)
      .send({ position: 0 })
      .expect(200);

    const state = await asAdmin(
      request(app).get(`/api/sessions/${host.session.code}/admin`),
      host.adminToken,
    ).expect(200);
    expect(state.body.session.questions.map((q: { prompt: string }) => q.prompt)).toEqual([
      "Third",
      "First",
      "Second",
    ]);
    void a;
    void b;
  });

  it("deletes a question and closes the gap in the ordering", async () => {
    const a = await addQuestion(host, { type: "fixed", prompt: "Keep", options: ["x"] });
    const b = await addQuestion(host, { type: "fixed", prompt: "Drop", options: ["y"] });
    const c = await addQuestion(host, { type: "fixed", prompt: "Keep2", options: ["z"] });

    await asAdmin(request(app).delete(`/api/questions/${b.id}`), host.adminToken).expect(204);

    const state = await asAdmin(
      request(app).get(`/api/sessions/${host.session.code}/admin`),
      host.adminToken,
    ).expect(200);
    const questions = state.body.session.questions as { id: string; position: number }[];
    expect(questions.map((q) => q.id)).toEqual([a.id, c.id]);
    expect(questions.map((q) => q.position)).toEqual([0, 1]);
  });

  it("blocks votes once the session has ended", async () => {
    const q = await addQuestion(host, { type: "fixed", prompt: "Over", options: ["x"] });
    await openQuestion(host, q.id);
    await asAdmin(request(app).patch(`/api/sessions/${host.session.code}`), host.adminToken)
      .send({ status: "ended" })
      .expect(200);

    const res = await new Voter(app).vote(q.id, { optionIds: [q.options[0].id] });
    expect(res.status).toBe(409);
    expect(res.body.error.details.reason).toBe("session_ended");
  });

  it("applies strict device checking when the host turns it on", async () => {
    await asAdmin(request(app).patch(`/api/sessions/${host.session.code}`), host.adminToken)
      .send({ strictDeviceCheck: true })
      .expect(200);

    const q = await addQuestion(host, { type: "fixed", prompt: "Strict", options: ["x"] });
    await openQuestion(host, q.id);

    const voter = new Voter(app, "same-print", "192.0.2.5");
    expect((await voter.vote(q.id, { optionIds: [q.options[0].id] })).status).toBe(201);

    // Same phone, fresh browser profile: the cookie is gone but the print matches.
    voter.forgetCookie();
    const again = await voter.vote(q.id, { optionIds: [q.options[0].id] });
    expect(again.status).toBe(409);
    expect(again.body.error.details.reason).toBe("device_already_voted");
  });
});

describe("voter state", () => {
  it("reports what this device has already answered", async () => {
    const host = await createHost(app);
    const q = await addQuestion(host, { type: "fixed", prompt: "Me?", options: ["A", "B"] });
    await openQuestion(host, q.id);

    const voter = new Voter(app);
    const before = await voter.me(host.session.code);
    expect(before.body.ballots).toEqual({});

    await voter.vote(q.id, { optionIds: [q.options[0].id] });

    const after = await voter.me(host.session.code);
    expect(after.body.ballots[q.id]).toEqual([q.options[0].id]);
  });
});
