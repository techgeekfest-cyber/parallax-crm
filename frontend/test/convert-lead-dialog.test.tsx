import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Lead } from "@/features/leads/api";
import { ConvertLeadDialog } from "@/features/leads/convert-lead-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// A qualified lead as the API returns it (test fixture only).
const lead: Lead = {
  id: "lead-1",
  number: "LD-000007",
  firstName: "Ada",
  lastName: "Lovelace",
  fullName: "Ada Lovelace",
  company: "Analytical Engines",
  email: "ada@engines.test",
  status: "QUALIFIED",
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-02T10:00:00Z",
  version: 3,
};

function renderDialog() {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConvertLeadDialog lead={lead} open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), fetchSpy };
}

describe("ConvertLeadDialog", () => {
  it("validates each step before moving on, and reviews everything before converting", async () => {
    const { user, fetchSpy } = renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Convert lead" });
    expect(screen.getByLabelText("Account name")).toHaveValue("Analytical Engines");

    await user.clear(screen.getByLabelText("Account name"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Account name is required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account/, current: "step" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Account name"), "Engines Ltd");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("First name")).toHaveValue("Ada");

    await user.clear(screen.getByLabelText(/^Email/));
    await user.type(screen.getByLabelText(/^Email/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^Email/));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Amount is required")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Amount (USD)"), "25000");
    await user.click(screen.getByRole("button", { name: "Next" }));
    const review = screen.getByRole("list", { name: "Review" });
    expect(review).toHaveTextContent("New account: Engines Ltd");
    expect(review).toHaveTextContent("Ada Lovelace");
    expect(review).toHaveTextContent("$25,000.00");
    expect(dialog).toContainElement(screen.getByRole("button", { name: "Convert lead" }));

    // Nothing has been sent: conversion happens only on "Convert lead".
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
