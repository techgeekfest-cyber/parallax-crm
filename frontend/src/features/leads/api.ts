"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Lead = components["schemas"]["LeadResponse"];
export type LeadSummary = components["schemas"]["LeadSummaryResponse"];
export type LeadPage = components["schemas"]["PageResponseLeadSummaryResponse"];
export type CreateLeadInput = components["schemas"]["CreateLeadRequest"];
export type LeadStatus = Lead["status"];
export type LeadSource = NonNullable<Lead["source"]>;

export type LeadListParams = {
  q?: string;
  status?: LeadStatus;
  ownerId?: string;
  /** zero-based */
  page: number;
  size: number;
  sort?: string;
};

export const leadKeys = {
  all: ["leads"] as const,
  lists: () => [...leadKeys.all, "list"] as const,
  list: (params: LeadListParams) => [...leadKeys.lists(), params] as const,
  detail: (id: string) => [...leadKeys.all, "detail", id] as const,
};

export function useLeads(params: LeadListParams) {
  return useQuery({
    queryKey: leadKeys.list(params),
    queryFn: ({ signal }) =>
      request(
        api.GET("/api/v1/leads", {
          params: {
            query: {
              q: params.q || undefined,
              status: params.status ? [params.status] : undefined,
              ownerId: params.ownerId,
              page: params.page,
              size: params.size,
              sort: params.sort,
            },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: ({ signal }) => request(api.GET("/api/v1/leads/{id}", { params: { path: { id } }, signal })),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) => request(api.POST("/api/v1/leads", { body: input })),
    onSuccess: (lead) => {
      // The server's response is authoritative: seed the detail cache and refetch every list.
      queryClient.setQueryData(leadKeys.detail(lead.id), lead);
      return queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}
