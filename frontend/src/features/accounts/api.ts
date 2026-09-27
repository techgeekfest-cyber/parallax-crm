"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Account = components["schemas"]["AccountResponse"];
export type AccountSummary = components["schemas"]["AccountSummaryResponse"];
export type AccountRequest = components["schemas"]["AccountRequest"];
export type AccountType = Account["type"];
export type AccountTier = Account["tier"];
export type SupportLevel = Account["supportLevel"];
export type FundingRound = NonNullable<NonNullable<Account["startup"]>["fundingRound"]>;
export type GrowthStage = NonNullable<NonNullable<Account["startup"]>["growthStage"]>;

export type AccountListParams = {
  q?: string;
  type?: AccountType;
  ownerId?: string;
  archived?: boolean;
  page: number;
  size: number;
  sort?: string;
};

export const accountKeys = {
  all: ["accounts"] as const,
  lists: () => [...accountKeys.all, "list"] as const,
  list: (params: AccountListParams) => [...accountKeys.lists(), params] as const,
  detail: (id: string) => [...accountKeys.all, "detail", id] as const,
};

export function useAccounts(params: AccountListParams, { enabled = true } = {}) {
  return useQuery({
    queryKey: accountKeys.list(params),
    queryFn: ({ signal }) =>
      request(api.GET("/api/v1/accounts", { params: { query: { ...params, q: params.q || undefined } }, signal })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: ({ signal }) => request(api.GET("/api/v1/accounts/{id}", { params: { path: { id } }, signal })),
  });
}

/** After any write, the server's copy replaces the cached detail and every list refetches. */
function useAccountWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<Account>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (account) => {
      queryClient.setQueryData(accountKeys.detail(account.id), account);
      return queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}

export function useCreateAccount() {
  return useAccountWrite((body: AccountRequest) => request(api.POST("/api/v1/accounts", { body })));
}

export function useUpdateAccount() {
  return useAccountWrite(({ id, body }: { id: string; body: AccountRequest }) =>
    request(api.PUT("/api/v1/accounts/{id}", { params: { path: { id } }, body })),
  );
}

export function useArchiveAccount() {
  return useAccountWrite(({ id, archive }: { id: string; archive: boolean }) =>
    archive
      ? request(api.POST("/api/v1/accounts/{id}/archive", { params: { path: { id } } }))
      : request(api.POST("/api/v1/accounts/{id}/restore", { params: { path: { id } } })),
  );
}
