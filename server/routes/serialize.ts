import type { QuestionDTO, SessionDTO, TallyDTO } from "../../shared/types.js";

/**
 * The audience view of a session. Draft questions are stripped entirely - a
 * voter with the join link should not be able to read the next question early
 * by hitting the JSON endpoint.
 */
export function publicSession(session: SessionDTO): SessionDTO {
  return {
    ...session,
    questions: session.questions.filter((q) => q.status !== "draft"),
  };
}

/** Whether the audience is allowed to see counts for this question yet. */
export function tallyVisible(question: QuestionDTO): boolean {
  switch (question.resultsVisibility) {
    case "live":
      return true;
    case "after_close":
      return question.status === "closed";
    case "hidden":
      return false;
  }
}

/** Counts stripped but options kept, so the wall can still show the field. */
export function redactTally(tally: TallyDTO): TallyDTO {
  return {
    ...tally,
    totalVotes: 0,
    entries: tally.entries.map((entry) => ({ ...entry, votes: 0 })),
  };
}
