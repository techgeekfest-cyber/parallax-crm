import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STAGE_DEFAULT_PROBABILITY, STAGE_LABELS, STAGES } from "@/features/opportunities/labels";
import { StageBadge } from "@/features/opportunities/stage-badge";

describe("StageBadge", () => {
  it.each(STAGES)("labels %s", (stage) => {
    render(<StageBadge stage={stage} />);
    expect(screen.getByText(STAGE_LABELS[stage])).toBeInTheDocument();
  });

  it("uses the same default probabilities as the backend", () => {
    expect(STAGE_DEFAULT_PROBABILITY).toEqual({
      PROSPECTING: 10,
      QUALIFICATION: 25,
      PROPOSAL: 50,
      NEGOTIATION: 75,
      CLOSED_WON: 100,
      CLOSED_LOST: 0,
    });
  });
});
