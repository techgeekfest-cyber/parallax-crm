"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { meKey, type Role } from "@/features/auth/api";
import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type User = components["schemas"]["UserResponse"];
export type CreateUserInput = components["schemas"]["CreateUserRequest"];
export type UpdateUserInput = components["schemas"]["UpdateUserRequest"];

export type UserListParams = { q?: string; role?: Role; active?: boolean; page: number; size: number };

export const userKeys = {
  all: ["users"] as const,
  list: (params: UserListParams) => [...userKeys.all, "list", params] as const,
};

export function useUsers(params: UserListParams, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: ({ signal }) =>
      request(api.GET("/api/v1/users", { params: { query: { ...params, q: params.q || undefined } }, signal })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Active users, for "owner" pickers. Only available to roles that may view the directory. */
export function useAssignableUsers(enabled: boolean) {
  return useUsers({ active: true, page: 0, size: 100 }, { enabled });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserInput) => request(api.POST("/api/v1/users", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserInput }) =>
      request(api.PUT("/api/v1/users/{id}", { params: { path: { id } }, body })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: userKeys.all }),
        queryClient.invalidateQueries({ queryKey: meKey }),
      ]),
  });
}
