"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Contact = components["schemas"]["ContactResponse"];
export type ContactSummary = components["schemas"]["ContactSummaryResponse"];
export type ContactRequest = components["schemas"]["ContactRequest"];

export type ContactListParams = {
  q?: string;
  accountId?: string;
  ownerId?: string;
  archived?: boolean;
  page: number;
  size: number;
  sort?: string;
};

export const contactKeys = {
  all: ["contacts"] as const,
  lists: () => [...contactKeys.all, "list"] as const,
  list: (params: ContactListParams) => [...contactKeys.lists(), params] as const,
  detail: (id: string) => [...contactKeys.all, "detail", id] as const,
};

export function useContacts(params: ContactListParams) {
  return useQuery({
    queryKey: contactKeys.list(params),
    queryFn: ({ signal }) =>
      request(api.GET("/api/v1/contacts", { params: { query: { ...params, q: params.q || undefined } }, signal })),
    placeholderData: keepPreviousData,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: ({ signal }) => request(api.GET("/api/v1/contacts/{id}", { params: { path: { id } }, signal })),
  });
}

/**
 * The server's copy replaces the cached detail; every contact list refetches, because making a contact primary can
 * demote another contact on the same account.
 */
function useContactWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<Contact>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (contact) => {
      queryClient.setQueryData(contactKeys.detail(contact.id), contact);
      return queryClient.invalidateQueries({ queryKey: contactKeys.all, predicate: (q) => q.queryKey[2] !== contact.id });
    },
  });
}

export function useCreateContact() {
  return useContactWrite((body: ContactRequest) => request(api.POST("/api/v1/contacts", { body })));
}

export function useUpdateContact() {
  return useContactWrite(({ id, body }: { id: string; body: ContactRequest }) =>
    request(api.PUT("/api/v1/contacts/{id}", { params: { path: { id } }, body })),
  );
}

export function useArchiveContact() {
  return useContactWrite(({ id, archive }: { id: string; archive: boolean }) =>
    archive
      ? request(api.POST("/api/v1/contacts/{id}/archive", { params: { path: { id } } }))
      : request(api.POST("/api/v1/contacts/{id}/restore", { params: { path: { id } } })),
  );
}
