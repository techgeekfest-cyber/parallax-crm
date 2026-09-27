"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { accountKeys } from "@/features/accounts/api";
import { invalidateTimelines } from "@/features/activities/api";
import { contactKeys } from "@/features/contacts/api";
import { opportunityKeys } from "@/features/opportunities/api";
import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Lead = components["schemas"]["LeadResponse"];
export type LeadSummary = components["schemas"]["LeadSummaryResponse"];
export type LeadPage = components["schemas"]["PageResponseLeadSummaryResponse"];
export type CreateLeadInput = components["schemas"]["CreateLeadRequest"];
export type LeadStatus = Lead["status"];
export type LeadSource = NonNullable<Lead["source"]>;
export type LeadConversionRequest = components["schemas"]["LeadConversion"];
export type LeadConversionResult = components["schemas"]["LeadConversionResponse"];

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

/** Moves a lead between New, Contacted, Qualified and Disqualified (with the version, so edits never collide silently). */
export function useChangeLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, version }: { id: string; status: Exclude<LeadStatus, "CONVERTED">; version: number }) =>
      request(api.POST("/api/v1/leads/{id}/status-transitions", { params: { path: { id } }, body: { status, version } })),
    onSuccess: (lead) => {
      queryClient.setQueryData(leadKeys.detail(lead.id), lead);
      return Promise.all([queryClient.invalidateQueries({ queryKey: leadKeys.lists() }), invalidateTimelines(queryClient)]);
    },
    onError: (_error, { id }) => queryClient.invalidateQueries({ queryKey: leadKeys.detail(id) }),
  });
}

/**
 * Converts a qualified lead. The server creates (or links) the account and creates the contact and opportunity in one
 * transaction; everything that lists those records is refreshed afterwards.
 */
export function useConvertLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: LeadConversionRequest }) =>
      request(api.POST("/api/v1/leads/{id}/conversion", { params: { path: { id } }, body })),
    onSuccess: (result) => {
      queryClient.setQueryData(leadKeys.detail(result.lead.id), result.lead);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: leadKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: accountKeys.all }),
        queryClient.invalidateQueries({ queryKey: contactKeys.all }),
        queryClient.invalidateQueries({ queryKey: opportunityKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-reps"] }),
        invalidateTimelines(queryClient),
      ]);
    },
    // A conflict or "already converted" means our copy of the lead is out of date.
    onError: (_error, { id }) => queryClient.invalidateQueries({ queryKey: leadKeys.detail(id) }),
  });
}
