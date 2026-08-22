import type { Express } from "express";
import request from "supertest";
import type { QuestionDTO, SessionDTO, TallyDTO } from "../shared/types.js";

export interface Host {
  app: Express;
  session: SessionDTO;
  adminToken: string;
}

export async function createHost(app: Express, title = "Test Arena"): Promise<Host> {
  const res = await request(app).post("/api/sessions").send({ title }).expect(201);
  return { app, session: res.body.session, adminToken: res.body.adminToken };
}

export function asAdmin(req: request.Test, token: string) {
  return req.set("x-admin-token", token);
}

export async function addQuestion(
  host: Host,
  body: Record<string, unknown>,
): Promise<QuestionDTO> {
  const res = await asAdmin(
    request(host.app).post(`/api/sessions/${host.session.code}/questions`),
    host.adminToken,
  )
    .send(body)
    .expect(201);
  return res.body.question;
}

export async function openQuestion(host: Host, id: string): Promise<QuestionDTO> {
  const res = await asAdmin(request(host.app).post(`/api/questions/${id}/open`), host.adminToken)
    .send({})
    .expect(200);
  return res.body.question;
}

export async function closeQuestion(host: Host, id: string): Promise<QuestionDTO> {
  const res = await asAdmin(request(host.app).post(`/api/questions/${id}/close`), host.adminToken)
    .send({})
    .expect(200);
  return res.body.question;
}

/**
 * A stand-in for one phone. It keeps its own cookie jar and device print, so two
 * Voters are two distinct people as far as the server is concerned.
 */
export class Voter {
  private cookie: string | null = null;
  private token: string | null = null;

  constructor(
    private readonly app: Express,
    readonly print = `print-${Math.random().toString(36).slice(2)}`,
    readonly ip = "203.0.113.10",
  ) {}

  private decorate(req: request.Test): request.Test {
    req.set("x-device-print", this.print).set("x-forwarded-for", this.ip);
    if (this.cookie) req.set("Cookie", this.cookie);
    if (this.token) req.set("x-voter-token", this.token);
    return req;
  }

  private absorb(res: request.Response): void {
    const setCookie = res.headers["set-cookie"];
    if (setCookie) {
      const raw = Array.isArray(setCookie) ? setCookie : [setCookie];
      const va = raw.find((c) => c.startsWith("va_voter="));
      if (va) this.cookie = va.split(";")[0];
    }
    if (typeof res.body?.token === "string") this.token = res.body.token;
  }

  async vote(
    questionId: string,
    payload: { optionIds?: string[]; writeIns?: string[] },
  ): Promise<request.Response> {
    const res = await this.decorate(request(this.app).post(`/api/questions/${questionId}/vote`))
      .send(payload);
    this.absorb(res);
    return res;
  }

  async me(code: string): Promise<request.Response> {
    const res = await this.decorate(request(this.app).get(`/api/sessions/${code}/me`));
    this.absorb(res);
    return res;
  }

  /** Drops the cookie but keeps the device print, like clearing site data. */
  forgetCookie(): void {
    this.cookie = null;
    this.token = null;
  }
}

export async function tallyOf(app: Express, questionId: string): Promise<TallyDTO> {
  const res = await request(app).get(`/api/questions/${questionId}/results`).expect(200);
  return res.body.tally;
}

export function votesFor(tally: TallyDTO, label: string): number {
  return tally.entries.find((e) => e.label.toLowerCase() === label.toLowerCase())?.votes ?? 0;
}
