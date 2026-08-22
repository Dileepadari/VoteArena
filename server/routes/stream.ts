import { Router } from "express";
import { hub } from "../lib/events.js";
import { asyncRoute } from "../lib/http.js";
import { getQuestionDTO, getSessionDTO, getSessionTallies } from "../store.js";
import { lookupSession } from "./sessions.js";
import { publicSession, redactTally, tallyVisible } from "./serialize.js";

export const streamRouter = Router();

/**
 * Live channel for a session. Opens with a `hello` frame carrying the whole
 * public state so a client never has to make a second request to render, then
 * streams `session` and `tally` frames as things change.
 */
streamRouter.get(
  "/sessions/:code/stream",
  asyncRoute((req, res) => {
    const session = lookupSession(req.params.code);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Tells nginx not to buffer the stream, which would hold frames back.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Ask the browser to wait a beat before reconnecting, so a server restart
    // does not turn into a reconnect storm from every phone in the room.
    res.write("retry: 3000\n\n");

    const unsubscribe = hub.subscribe(session.code, res);

    const dto = publicSession(getSessionDTO(session.id));
    const tallies = getSessionTallies(session.id)
      .filter((tally) => dto.questions.some((q) => q.id === tally.questionId))
      .map((tally) =>
        tallyVisible(getQuestionDTO(tally.questionId)) ? tally : redactTally(tally),
      );

    res.write(`event: hello\ndata: ${JSON.stringify({ session: dto, tallies })}\n\n`);

    req.on("close", () => {
      unsubscribe();
      res.end();
    });
  }),
);
