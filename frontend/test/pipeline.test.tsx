import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { transitionStage, type Opportunity } from "@/features/opportunities/api";
import {
  applyServerOpportunity,
  moveCard,
  pipelineKeys,
  useMoveOpportunity,
  type Pipeline,
  type PipelineCard,
} from "@/features/pipeline/api";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { ApiError } from "@/lib/api/errors";

// The unit under test is the client's optimistic handling; the real endpoint is exercised by the E2E suite.
vi.mock("@/features/opportunities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/opportunities/api")>();
  return { ...actual, transitionStage: vi.fn() };
});

const account = { id: "acc-1", name: "Contoso", type: "SMB" as const, archived: false };

// A board as the API returns it (test fixture only).
function card(id: string, stage: PipelineCard["stage"], allowedStages: PipelineCard["stage"][]): PipelineCard {
  return {
    id,
    number: `OPP-${id}`,
    name: `Deal ${id}`,
    account,
    amount: 10000,
    stage,
    probability: 10,
    closeDate: "2099-01-31",
    owner: { id: "u1", fullName: "Avery Stone", active: true },
    version: 0,
    allowedStages,
  };
}

function board(): Pipeline {
  const stages = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"] as const;
  return {
    columns: stages.map((stage) => ({
      stage,
      count: stage === "PROSPECTING" ? 3 : 0,
      amount: stage === "PROSPECTING" ? 30000 : 0,
      weightedAmount: stage === "PROSPECTING" ? 3000 : 0,
      opportunities: stage === "PROSPECTING" ? [card("1", "PROSPECTING", ["QUALIFICATION", "CLOSED_LOST"]), card("2", "PROSPECTING", [])] : [],
    })),
    totals: { openCount: 3, openAmount: 30000, weightedAmount: 3000, wonCount: 0, wonAmount: 0, lostCount: 0 },
  };
}

const idsIn = (b: Pipeline | undefined, stage: string) =>
  b?.columns.find((column) => column.stage === stage)?.opportunities.map((c) => c.id) ?? [];

describe("pipeline board", () => {
  it("renders every stage with the server's counts and amounts, and each card's details", () => {
    render(<PipelineBoard board={board()} showOwner onMove={vi.fn()} onRejectedMove={vi.fn()} />);

    const columns = screen.getAllByRole("listitem").filter((el) => el.tagName === "SECTION");
    expect(columns.map((column) => within(column).getByRole("heading").textContent)).toEqual([
      "Prospecting",
      "Qualification",
      "Proposal",
      "Negotiation",
      "Closed won",
      "Closed lost",
    ]);
    const prospecting = columns[0];
    expect(within(prospecting).getByLabelText("3 opportunities")).toBeInTheDocument();
    expect(prospecting).toHaveTextContent("$30,000");
    expect(prospecting).toHaveTextContent("$3,000 weighted");
    // Two cards shown, the third is behind a link to the list.
    expect(within(prospecting).getByRole("link", { name: "1 more in this stage" })).toHaveAttribute("href", "/opportunities?stage=PROSPECTING");

    const deal = within(prospecting).getByRole("article", { name: "Deal 1" });
    expect(within(deal).getByRole("link", { name: "Deal 1" })).toHaveAttribute("href", "/opportunities/1");
    expect(deal).toHaveTextContent("Contoso");
    expect(deal).toHaveTextContent("$10,000");
    expect(deal).toHaveTextContent("10%");
    expect(deal).toHaveTextContent("Avery Stone");
    // Only cards the viewer may move get a drag handle and a move menu.
    expect(within(deal).getByRole("button", { name: "Drag Deal 1 to another stage" })).toBeInTheDocument();
    expect(within(prospecting).getByRole("article", { name: "Deal 2" }).querySelector("button")).toBeNull();
    expect(within(columns[1]).getByText("No opportunities")).toBeInTheDocument();
  });
});

describe("optimistic moves", () => {
  it("moves only the card, leaving the server's totals untouched", () => {
    const moved = moveCard(board(), "1", "QUALIFICATION");
    expect(idsIn(moved, "PROSPECTING")).toEqual(["2"]);
    expect(idsIn(moved, "QUALIFICATION")).toEqual(["1"]);
    expect(moved.columns[0].count).toBe(3);
    expect(moved.totals).toEqual(board().totals);
    expect(moveCard(board(), "missing", "PROPOSAL")).toEqual(board());
  });

  it("replaces a card with the server's version of the opportunity", () => {
    const server = { id: "1", number: "OPP-1", name: "Deal 1", account, amount: 10000, stage: "QUALIFICATION", probability: 25, closeDate: "2099-01-31", version: 1, allowedStages: ["PROSPECTING", "PROPOSAL", "CLOSED_LOST"] } as Opportunity;
    const updated = applyServerOpportunity(moveCard(board(), "1", "QUALIFICATION"), server);
    const serverCard = updated.columns[1].opportunities[0];
    expect(serverCard).toMatchObject({ id: "1", probability: 25, version: 1 });
    expect(serverCard.allowedStages).toEqual(["PROSPECTING", "PROPOSAL", "CLOSED_LOST"]);
  });
});

describe("useMoveOpportunity", () => {
  const params = { ownerId: undefined, q: undefined };
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(pipelineKeys.board(params), board());
    vi.mocked(transitionStage).mockReset();
  });

  it("shows the move at once, then rolls it back when the server refuses", async () => {
    let refuse!: (error: unknown) => void;
    vi.mocked(transitionStage).mockReturnValue(new Promise((_, reject) => (refuse = reject)));
    const { result } = renderHook(() => useMoveOpportunity(params), { wrapper });
    const deal = board().columns[0].opportunities[0];

    act(() => result.current.mutate({ card: deal, toStage: "QUALIFICATION" }));
    await waitFor(() => expect(idsIn(queryClient.getQueryData(pipelineKeys.board(params)), "QUALIFICATION")).toEqual(["1"]));
    expect(transitionStage).toHaveBeenCalledWith({ id: "1", toStage: "QUALIFICATION", version: 0 });

    act(() => refuse(new ApiError(409, "CONFLICT", "This opportunity was changed by someone else.")));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(pipelineKeys.board(params))).toEqual(board());
    // And the board is marked stale so it is refetched from the server.
    expect(queryClient.getQueryState(pipelineKeys.board(params))?.isInvalidated).toBe(true);
  });

  it("keeps the server's answer when the move succeeds", async () => {
    const server = { id: "1", number: "OPP-1", name: "Deal 1", account, amount: 10000, stage: "QUALIFICATION", probability: 25, closeDate: "2099-01-31", version: 1, allowedStages: ["PROSPECTING", "PROPOSAL", "CLOSED_LOST"] } as Opportunity;
    vi.mocked(transitionStage).mockResolvedValue(server);
    const { result } = renderHook(() => useMoveOpportunity(params), { wrapper });

    await act(() => result.current.mutateAsync({ card: board().columns[0].opportunities[0], toStage: "QUALIFICATION" }));
    const qualification = queryClient.getQueryData<Pipeline>(pipelineKeys.board(params))!.columns[1].opportunities;
    expect(qualification).toHaveLength(1);
    expect(qualification[0]).toMatchObject({ probability: 25, version: 1 });
  });
});
