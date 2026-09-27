"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateTimelines } from "@/features/activities/api";
import { opportunityKeys, transitionStage, type Opportunity, type OpportunityStage } from "@/features/opportunities/api";
import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Pipeline = components["schemas"]["PipelineResponse"];
export type PipelineColumn = components["schemas"]["PipelineColumnResponse"];
export type PipelineCard = components["schemas"]["PipelineCardResponse"];
export type PipelineParams = { q?: string; ownerId?: string };

export const pipelineKeys = {
  all: ["pipeline"] as const,
  board: (params: PipelineParams) => [...pipelineKeys.all, params] as const,
};

/** Cards per column. Column counts and amounts always cover the whole stage (computed by the server). */
export const CARDS_PER_COLUMN = 50;

export function usePipeline(params: PipelineParams, { enabled = true } = {}) {
  return useQuery({
    queryKey: pipelineKeys.board(params),
    queryFn: ({ signal }) =>
      request(api.GET("/api/v1/pipeline", { params: { query: { ...params, q: params.q || undefined, limit: CARDS_PER_COLUMN } }, signal })),
    enabled,
  });
}

/**
 * The board with one card shown in another column — the optimistic view while the server decides. Only the card moves:
 * column counts and amounts are the server's figures and are refetched once the move is settled.
 */
export function moveCard(board: Pipeline, cardId: string, toStage: OpportunityStage): Pipeline {
  const card = board.columns.flatMap((column) => column.opportunities).find((candidate) => candidate.id === cardId);
  if (!card || card.stage === toStage) return board;
  const moved: PipelineCard = { ...card, stage: toStage, allowedStages: [] };
  return {
    ...board,
    columns: board.columns.map((column) => {
      if (column.stage === card.stage) return { ...column, opportunities: column.opportunities.filter((c) => c.id !== cardId) };
      if (column.stage === toStage) return { ...column, opportunities: [moved, ...column.opportunities] };
      return column;
    }),
  };
}

/** The board with a card replaced by the server's version of the opportunity. */
export function applyServerOpportunity(board: Pipeline, opportunity: Opportunity): Pipeline {
  const card: PipelineCard = {
    id: opportunity.id,
    number: opportunity.number,
    name: opportunity.name,
    account: opportunity.account,
    amount: opportunity.amount,
    stage: opportunity.stage,
    probability: opportunity.probability,
    closeDate: opportunity.closeDate,
    closedAt: opportunity.closedAt,
    nextStep: opportunity.nextStep,
    owner: opportunity.owner,
    version: opportunity.version,
    allowedStages: opportunity.allowedStages,
  };
  return {
    ...board,
    columns: board.columns.map((column) => {
      const without = column.opportunities.filter((c) => c.id !== card.id);
      return column.stage === card.stage ? { ...column, opportunities: [card, ...without] } : { ...column, opportunities: without };
    }),
  };
}

/**
 * Drag-and-drop moves: the card jumps to the new column at once, then the real stage-transition API decides. The
 * server's response replaces the optimistic card; an invalid move or a conflict puts the board back as it was. Either
 * way the board (with its server-computed totals) is refetched.
 */
export function useMoveOpportunity(params: PipelineParams) {
  const queryClient = useQueryClient();
  const key = pipelineKeys.board(params);
  return useMutation({
    mutationFn: ({ card, toStage }: { card: PipelineCard; toStage: OpportunityStage }) =>
      transitionStage({ id: card.id, toStage, version: card.version }),
    onMutate: async ({ card, toStage }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Pipeline>(key);
      if (previous) queryClient.setQueryData<Pipeline>(key, moveCard(previous, card.id, toStage));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (opportunity) => {
      const current = queryClient.getQueryData<Pipeline>(key);
      if (current) queryClient.setQueryData<Pipeline>(key, applyServerOpportunity(current, opportunity));
      queryClient.setQueryData(opportunityKeys.detail(opportunity.id), opportunity);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: pipelineKeys.all }),
        queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: opportunityKeys.summaries() }),
        queryClient.invalidateQueries({ queryKey: ["sales-reps"] }),
        invalidateTimelines(queryClient),
      ]),
  });
}
