"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { api, postWithoutBody, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Me = components["schemas"]["MeResponse"];
export type Role = Me["role"];
export type Permissions = Me["permissions"];

export const meKey = ["auth", "me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: ({ signal }) => request(api.GET("/api/v1/auth/me", { signal })),
    staleTime: 5 * 60_000,
  });
}

/** Permissions of the signed-in user, or undefined while loading. The API enforces them regardless. */
export function usePermissions(): Permissions | undefined {
  return useMe().data?.permissions;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      request(api.POST("/api/v1/auth/login", { body: credentials })),
    meta: { handlesUnauthenticated: true },
    onSuccess: (me) => {
      queryClient.clear();
      queryClient.setQueryData(meKey, me);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => postWithoutBody("/api/v1/auth/logout"),
    onSettled: () => {
      // Whatever the server said, leave no data from this session in memory.
      queryClient.clear();
      router.replace("/login");
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      request(api.PUT("/api/v1/auth/password", { body })),
  });
}
