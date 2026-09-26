import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/features/leads/labels";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";

describe("LeadStatusBadge", () => {
  it.each(LEAD_STATUSES)("renders a readable label for %s", (status) => {
    render(<LeadStatusBadge status={status} />);
    expect(screen.getByText(LEAD_STATUS_LABELS[status])).toBeInTheDocument();
  });
});
