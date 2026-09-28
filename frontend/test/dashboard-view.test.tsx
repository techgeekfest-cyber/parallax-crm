import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Dashboard } from "@/features/dashboard/api";
import { useDashboard } from "@/features/dashboard/api";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { useMe } from "@/features/auth/api";
import { ApiError } from "@/lib/api/errors";

// The view is tested against API-shaped responses; the real endpoint is covered by backend and E2E tests.
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => search, usePathname: () => "/dashboard" }));
vi.mock("@/features/dashboard/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/dashboard/api")>()),
  useDashboard: vi.fn(),
}));
vi.mock("@/features/auth/api", () => ({ useMe: vi.fn() }));
vi.mock("@/features/users/owner-filter", () => ({
  useOwnerFilter: (owner: string | undefined) => ({ items: { ALL: "All owners", me: "Mine" }, ownerId: owner, ready: true }),
}));

beforeAll(() => {
  // Recharts measures its container; jsdom has no layout.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const periodOf = (range: Dashboard["period"]["range"] = "LAST_12_MONTHS"): Dashboard["period"] => ({
  range,
  from: "2025-10-01",
  to: "2026-09-28",
  bucket: "MONTH",
});
const zero = (stage: Dashboard["stages"][number]["stage"]) => ({ stage, count: 0, amount: 0, weightedAmount: 0 });

function populated(): Dashboard {
  return {
    period: periodOf(),
    scope: { organisation: true },
    records: { leads: 3, openLeads: 3, newLeads: 3, accounts: 2, contacts: 1, opportunities: 7, newOpportunities: 7 },
    pipeline: { openCount: 3, openAmount: 70000, weightedAmount: 36000 },
    outcomes: { wonCount: 2, wonAmount: 80000, lostCount: 1, winRatePercent: 66.7, averageDealSize: 40000 },
    quota: { year: 2026, ytdSales: 80000, quota: 150000, attainmentPercent: 53.3 },
    stages: [
      { stage: "PROSPECTING", count: 1, amount: 10000, weightedAmount: 1000, sharePercent: 14.3 },
      zero("QUALIFICATION"),
      { stage: "PROPOSAL", count: 1, amount: 40000, weightedAmount: 20000, sharePercent: 57.1 },
      { stage: "NEGOTIATION", count: 1, amount: 20000, weightedAmount: 15000, sharePercent: 28.6 },
      { stage: "CLOSED_WON", count: 2, amount: 80000, weightedAmount: 80000, sharePercent: 66.7 },
      { stage: "CLOSED_LOST", count: 1, amount: 5000, weightedAmount: 0, sharePercent: 33.3 },
    ],
    trend: [
      { periodStart: "2026-08-01", wonCount: 0, wonAmount: 0 },
      { periodStart: "2026-09-01", wonCount: 2, wonAmount: 80000 },
    ],
    forecast: {
      months: [{ month: "2026-09-01", count: 1, amount: 10000, weightedAmount: 1000 }],
      overdueCount: 1,
      overdueAmount: 20000,
      laterCount: 0,
      laterAmount: 0,
    },
    team: {
      total: 1,
      rows: [
        {
          rep: { id: "u1", fullName: "Avery Stone", active: true },
          role: "SALES_REP",
          territory: "EMEA",
          quota: 100000,
          ytdSales: 30000,
          attainmentPercent: 30,
          wonCount: 1,
          wonAmount: 30000,
          lostCount: 1,
          winRatePercent: 50,
          openCount: 2,
          openAmount: 50000,
          weightedAmount: 21000,
        },
      ],
    },
  };
}

function empty(): Dashboard {
  return {
    period: periodOf(),
    scope: { organisation: true },
    records: { leads: 0, openLeads: 0, newLeads: 0, accounts: 0, contacts: 0, opportunities: 0, newOpportunities: 0 },
    pipeline: { openCount: 0, openAmount: 0, weightedAmount: 0 },
    outcomes: { wonCount: 0, wonAmount: 0, lostCount: 0 },
    quota: { year: 2026, ytdSales: 0 },
    stages: (["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"] as const).map(zero),
    trend: [{ periodStart: "2026-09-01", wonCount: 0, wonAmount: 0 }],
    forecast: { months: [{ month: "2026-09-01", count: 0, amount: 0, weightedAmount: 0 }], overdueCount: 0, overdueAmount: 0, laterCount: 0, laterAmount: 0 },
    team: { total: 0, rows: [] },
  };
}

function signedInAs(accessAllSalesRecords: boolean) {
  vi.mocked(useMe).mockReturnValue({ data: { id: "me", permissions: { accessAllSalesRecords, viewUsers: accessAllSalesRecords } } } as unknown as ReturnType<typeof useMe>);
}

function serve(result: Partial<ReturnType<typeof useDashboard>>) {
  vi.mocked(useDashboard).mockReturnValue({ isPending: false, isFetching: false, refetch: vi.fn(), ...result } as unknown as ReturnType<typeof useDashboard>);
}

const tile = (label: string) => screen.getByRole("group", { name: label });

afterEach(cleanup);

beforeEach(() => {
  search = new URLSearchParams();
  vi.mocked(useDashboard).mockReset();
  signedInAs(true);
});

describe("DashboardView", () => {
  it("shows the server's figures, formatted", () => {
    serve({ data: populated() });
    render(<DashboardView />);

    expect(tile("Open pipeline")).toHaveTextContent("$70K");
    expect(tile("Open pipeline")).toHaveTextContent("3 open deals · $70,000");
    expect(tile("Weighted pipeline")).toHaveTextContent("$36K");
    expect(tile("Closed-won revenue")).toHaveTextContent("$80K");
    expect(tile("Win rate")).toHaveTextContent("66.7%");
    expect(tile("Win rate")).toHaveTextContent("2 won · 1 lost");
    expect(tile("Average deal size")).toHaveTextContent("$40K");
    expect(tile("Quota attainment")).toHaveTextContent("53.3%");
    expect(within(tile("Quota attainment")).getByRole("meter")).toHaveAttribute("aria-valuenow", "53");
    expect(tile("Leads")).toHaveTextContent("3");
    expect(tile("Opportunities")).toHaveTextContent("7");

    const proposal = document.querySelector('[data-stage="PROPOSAL"]')!;
    expect(proposal).toHaveTextContent("$40K · 1 deal");
    expect(within(proposal as HTMLElement).getByTitle("$40,000.00")).toBeInTheDocument();
    expect(proposal).toHaveTextContent("57.1% of value");
    expect(document.querySelector('[data-stage="CLOSED_WON"]')).toHaveTextContent("66.7% of closed");

    const team = screen.getByRole("table", { name: "Performance by sales rep" });
    expect(within(team).getByText("Avery Stone")).toBeInTheDocument();
    expect(team).toHaveTextContent("30%");
    expect(team).toHaveTextContent("of $100,000");
    expect(screen.getByText(/20,000\) — expected close date has passed/)).toBeInTheDocument();
    expect(screen.getByText(/Your organisation · Last 12 months/)).toBeInTheDocument();
  });

  it("uses honest empty states for an empty database instead of zeroed conclusions", () => {
    serve({ data: empty() });
    render(<DashboardView />);

    expect(screen.getByRole("heading", { name: "No sales data yet" })).toBeInTheDocument();
    expect(tile("Win rate")).toHaveTextContent("—");
    expect(tile("Win rate")).toHaveTextContent("No closed deals yet");
    expect(tile("Win rate")).not.toHaveTextContent("0%");
    expect(tile("Average deal size")).toHaveTextContent("No deals won yet");
    expect(tile("Quota attainment")).toHaveTextContent("No quota set");
    expect(tile("Open pipeline")).toHaveTextContent("No open deals");
    expect(screen.getByText("No closed-won revenue in this period")).toBeInTheDocument();
    expect(screen.getByText("No open deals", { selector: "p.text-sm" })).toBeInTheDocument();
    expect(screen.getByText(/No sales reps or managers yet/)).toBeInTheDocument();
    expect(screen.queryByText("NaN", { exact: false })).not.toBeInTheDocument();
  });

  it("shows skeletons while loading and a retry on error", () => {
    serve({ isPending: true, isFetching: true });
    const { unmount } = render(<DashboardView />);
    expect(screen.getByRole("group", { name: "Open pipeline" }).querySelector("[data-slot=skeleton]")).not.toBeNull();
    unmount();

    const refetch = vi.fn();
    serve({ error: new ApiError(500, "INTERNAL_ERROR", "Something went wrong on our side."), refetch });
    render(<DashboardView />);
    expect(screen.getByText("Couldn't load the dashboard")).toBeInTheDocument();
    screen.getByRole("button", { name: /try again|retry/i }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it("sends the period and owner from the URL to the server", () => {
    search = new URLSearchParams("range=LAST_30_DAYS&owner=u1");
    serve({ data: { ...populated(), period: periodOf("LAST_30_DAYS") } });
    render(<DashboardView />);
    expect(useDashboard).toHaveBeenCalledWith({ range: "LAST_30_DAYS", ownerId: "u1" }, { enabled: true });

    search = new URLSearchParams("range=NONSENSE");
    render(<DashboardView />);
    expect(useDashboard).toHaveBeenLastCalledWith({ range: "LAST_12_MONTHS", ownerId: undefined }, { enabled: true });
  });

  it("gives reps their own view: no owner filter, and never another owner in the request", () => {
    signedInAs(false);
    search = new URLSearchParams("owner=someone-else");
    serve({ data: { ...populated(), scope: { organisation: false, owner: { id: "me", fullName: "Avery Stone", active: true } } } });
    render(<DashboardView />);

    expect(screen.queryByRole("combobox", { name: "Filter by owner" })).not.toBeInTheDocument();
    expect(useDashboard).toHaveBeenCalledWith({ range: "LAST_12_MONTHS", ownerId: undefined }, { enabled: true });
    expect(screen.getByText("Performance", { selector: "[data-slot=card-title]" })).toBeInTheDocument();
    expect(screen.getByText(/Avery Stone · Last 12 months/)).toBeInTheDocument();
  });

  it("offers managers the owner filter", () => {
    serve({ data: populated() });
    render(<DashboardView />);
    expect(screen.getByRole("combobox", { name: "Filter by owner" })).toBeInTheDocument();
    expect(screen.getByText("Team performance")).toBeInTheDocument();
  });
});

describe("empty figures for one owner", () => {
  it("names the person whose figures are empty, and says 'you' only for your own", () => {
    serve({ data: { ...empty(), scope: { organisation: false, owner: { id: "u9", fullName: "Nora Newhire", active: true } } } });
    render(<DashboardView />);
    expect(screen.getByRole("heading", { name: "Nora Newhire has no sales data yet" })).toBeInTheDocument();
    cleanup();

    signedInAs(false);
    serve({ data: { ...empty(), scope: { organisation: false, owner: { id: "me", fullName: "Avery Stone", active: true } } } });
    render(<DashboardView />);
    expect(screen.getByRole("heading", { name: "You have no sales data yet" })).toBeInTheDocument();
  });
});
