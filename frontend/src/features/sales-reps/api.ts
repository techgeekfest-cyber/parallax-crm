"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { userKeys } from "@/features/users/api";
import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type SalesRep = components["schemas"]["SalesRepResponse"];
export type SalesProfileRequest = components["schemas"]["SalesProfileRequest"];
export type CreateSalesRepRequest = components["schemas"]["CreateSalesRepRequest"];

export const salesRepKeys = {
  all: ["sales-reps"] as const,
  list: (params: { q?: string; page: number; size: number }) => [...salesRepKeys.all, "list", params] as const,
};

export function useSalesReps(params: { q?: string; page: number; size: number }) {
  return useQuery({
    queryKey: salesRepKeys.list(params),
    queryFn: ({ signal }) =>
      request(api.GET("/api/v1/sales-reps", { params: { query: { ...params, q: params.q || undefined } }, signal })),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateSalesProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SalesProfileRequest }) =>
      request(api.PUT("/api/v1/sales-reps/{id}", { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: salesRepKeys.all }),
  });
}

export function useCreateSalesRep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSalesRepRequest) => request(api.POST("/api/v1/sales-reps", { body })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: salesRepKeys.all }),
        queryClient.invalidateQueries({ queryKey: userKeys.all }),
      ]),
  });
}
