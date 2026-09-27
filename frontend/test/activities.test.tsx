import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { activityFormSchema, emptyActivityForm, toActivityRequest } from "@/features/activities/activity-form";
import { ActivityList } from "@/features/activities/activity-list";
import type { Activity } from "@/features/activities/api";

// Timeline entries as the API returns them (test fixtures only).
const activities: Activity[] = [
  {
    id: "a2",
    type: "STAGE_CHANGE",
    subject: "Stage changed from Proposal to Negotiation",
    body: "Pricing agreed",
    actor: { id: "u1", fullName: "Avery Stone", active: true },
    occurredAt: "2026-09-27T14:30:00Z",
    system: true,
    opportunityId: "o1",
  },
  {
    id: "a1",
    type: "CALL",
    subject: "Discovery call",
    occurredAt: "2026-09-26T09:00:00Z",
    system: false,
    opportunityId: "o1",
  },
];

describe("ActivityList", () => {
  it("shows type, subject, body, actor and time for each entry, in the order given", () => {
    render(<ActivityList activities={activities} />);
    const items = within(screen.getByRole("list", { name: "Activity timeline" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Stage changed from Proposal to Negotiation");
    expect(items[0]).toHaveTextContent("Stage update · automatic");
    expect(items[0]).toHaveTextContent("Pricing agreed");
    expect(items[0]).toHaveTextContent("Avery Stone");
    expect(within(items[0]).getByText(/2026/).closest("time")).toHaveAttribute("dateTime", "2026-09-27T14:30:00Z");
    expect(items[1]).toHaveTextContent("Discovery call");
    expect(items[1]).toHaveTextContent("Call");
    expect(items[1]).not.toHaveTextContent("automatic");
    expect(items[1]).toHaveTextContent("System");
  });
});

describe("log activity form", () => {
  it("requires a subject and refuses future times", () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const result = activityFormSchema.safeParse({ ...emptyActivityForm, subject: " ", occurredAt: future });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["subject", "occurredAt"]);
  });

  it("only offers types people log by hand", () => {
    expect(activityFormSchema.safeParse({ ...emptyActivityForm, type: "STAGE_CHANGE", subject: "x" }).success).toBe(false);
  });

  it("sends an instant, or nothing for 'now'", () => {
    const now = toActivityRequest({ type: "NOTE", subject: " Follow up ", body: "", occurredAt: "" });
    expect(now).toEqual({ type: "NOTE", subject: "Follow up", body: undefined, occurredAt: undefined });
    const past = toActivityRequest({ type: "CALL", subject: "Call", body: "Notes", occurredAt: "2026-09-01T10:30" });
    expect(past.occurredAt).toBe(new Date("2026-09-01T10:30").toISOString());
  });
});
