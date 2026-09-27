"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Opportunity = components["schemas"]["OpportunityResponse"];
export type OpportunitySummary = components["schemas"]["OpportunitySummaryResponse"];
export type OpportunityRequest = components["schemas"]["OpportunityRequest"];
export type PipelineSummary = components["schemas"]["PipelineSummaryResponse"];
export type OpportunityStage = Opportunity["stage"];
export type OpportunityType = NonNullable<Opportunity["type"]>;

export type OpportunityListParams = {
  q?: string;
  stage?: OpportunityStage[];
  accountId?: string;
  ownerId?: string;
  archived?: boolean;
  page: number;
  size: number;
  sort?: string;
};

export const opportunityKeys = {
  all: ["opportunities"] as const,
  lists: () => [...opportunityKeys.all, "list"] as const,
  list: (params: OpportunityListParams) => [...opportunityKeys.lists(), params] as const,
  summaries: () => [...opportunityKeys.all, "summary"] as const,
  summary: (params: { accountId?: string; ownerId?: string }) => [...opportunityKeys.summaries(), params] as const,
  detail: (id: string) => [...opportunityKeys.all, "detail", id] as const,
};

export function useOpportunities(params: OpportunityListParams) {
  return useQuery({
    queryKey: opportunityKeys.list(params),
    queryFn: ({ signal }) =>
      request(api.GET("/api/v1/opportunities", { params: { query: { ...params, q: params.q || undefined } }, signal })),
    placeholderData: keepPreviousData,
  });
}

export function useOpportunity(id: string) {
  return useQuery({
    queryKey: opportunityKeys.detail(id),
    queryFn: ({ signal }) => request(api.GET("/api/v1/opportunities/{id}", { params: { path: { id } }, signal })),
  });
}

/** Open, weighted and won totals over what the viewer can see (reps: their own deals). */
export function usePipelineSummary(params: { accountId?: string; ownerId?: string }) {
  return useQuery({
    queryKey: opportunityKeys.summary(params),
    queryFn: ({ signal }) => request(api.GET("/api/v1/opportunities/summary", { params: { query: params }, signal })),
  });
}

function useOpportunityWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<Opportunity>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (opportunity) => {
      queryClient.setQueryData(opportunityKeys.detail(opportunity.id), opportunity);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: opportunityKeys.summaries() }),
        queryClient.invalidateQueries({ queryKey: ["sales-reps"] }),
      ]);
    },
  });
}

export function useCreateOpportunity() {
  return useOpportunityWrite((body: OpportunityRequest) => request(api.POST("/api/v1/opportunities", { body })));
}

export function useUpdateOpportunity() {
  return useOpportunityWrite(({ id, body }: { id: string; body: OpportunityRequest }) =>
    request(api.PUT("/api/v1/opportunities/{id}", { params: { path: { id } }, body })),
  );
}

export function useArchiveOpportunity() {
  return useOpportunityWrite(({ id, archive }: { id: string; archive: boolean }) =>
    archive
      ? request(api.POST("/api/v1/opportunities/{id}/archive", { params: { path: { id } } }))
      : request(api.POST("/api/v1/opportunities/{id}/restore", { params: { path: { id } } })),
  );
}
