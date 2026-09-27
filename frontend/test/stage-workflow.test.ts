import { describe, expect, it } from "vitest";

import { describeTransitionError, moveKind, moveLabel } from "@/features/opportunities/stage-workflow";
import { ApiError } from "@/lib/api/errors";

describe("stage workflow presentation", () => {
  it("names each kind of move", () => {
    expect(moveKind("PROSPECTING", "QUALIFICATION")).toBe("forward");
    expect(moveKind("PROPOSAL", "QUALIFICATION")).toBe("back");
    expect(moveKind("NEGOTIATION", "CLOSED_WON")).toBe("won");
    expect(moveKind("PROSPECTING", "CLOSED_LOST")).toBe("lost");
    expect(moveKind("CLOSED_LOST", "PROPOSAL")).toBe("reopen");
    expect(moveLabel("PROSPECTING", "QUALIFICATION")).toBe("Advance to Qualification");
    expect(moveLabel("CLOSED_WON", "NEGOTIATION")).toBe("Reopen in Negotiation");
  });

  it("explains rejected moves in plain language", () => {
    expect(describeTransitionError(new ApiError(409, "CONFLICT", "stale"))).toMatch(/Someone else changed this opportunity/);
    const invalid = new ApiError(409, "INVALID_STATE_TRANSITION", "An opportunity in Prospecting can't move to Negotiation.");
    expect(describeTransitionError(invalid)).toBe(invalid.message);
  });
});
