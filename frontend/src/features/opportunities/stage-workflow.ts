import { isApiError } from "@/lib/api/errors";

import type { OpportunityStage } from "./api";
import { OPEN_STAGES, STAGE_LABELS } from "./labels";

/**
 * Presentation helpers for the stage workflow. The rules themselves live on the server: each opportunity (and each
 * pipeline card) carries `allowedStages`, and the server validates every transition again.
 */

/** The kind of move, which decides how the UI offers and confirms it. */
export function moveKind(from: OpportunityStage, to: OpportunityStage): "forward" | "back" | "won" | "lost" | "reopen" {
  if (to === "CLOSED_WON") return "won";
  if (to === "CLOSED_LOST") return "lost";
  if (from === "CLOSED_WON" || from === "CLOSED_LOST") return "reopen";
  return OPEN_STAGES.indexOf(to) > OPEN_STAGES.indexOf(from) ? "forward" : "back";
}

export function moveLabel(from: OpportunityStage, to: OpportunityStage): string {
  switch (moveKind(from, to)) {
    case "won":
      return "Mark won";
    case "lost":
      return "Mark lost";
    case "reopen":
      return `Reopen in ${STAGE_LABELS[to]}`;
    case "forward":
      return `Advance to ${STAGE_LABELS[to]}`;
    case "back":
      return `Back to ${STAGE_LABELS[to]}`;
  }
}

/** A sentence for a rejected move that tells people what happened and what to do next. */
export function describeTransitionError(error: unknown): string {
  if (isApiError(error, "CONFLICT")) {
    return "Someone else changed this opportunity first. The latest version is now shown — try again if the move still makes sense.";
  }
  if (isApiError(error, "INVALID_STATE_TRANSITION") || isApiError(error, "PERMISSION_DENIED")) return error.message;
  return isApiError(error) ? error.message : "The stage couldn't be changed. Please try again.";
}
