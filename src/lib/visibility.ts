import type { QuestionDTO } from "../../shared/types";

/**
 * Mirrors `tallyVisible` on the server. The server is still the authority - it
 * zeroes the counts before they leave the process - but the client needs the
 * same answer to decide whether to show a chart or a "sealed" placeholder.
 */
export function resultsRevealed(question: QuestionDTO): boolean {
  switch (question.resultsVisibility) {
    case "live":
      return true;
    case "after_close":
      return question.status === "closed";
    case "hidden":
      return false;
  }
}
