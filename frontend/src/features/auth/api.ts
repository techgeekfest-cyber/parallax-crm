"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { api, postWithoutBody, request } from "@/lib/api/client";
import { useHydrated } from "@/lib/use-hydrated";
import type { components } from "@/lib/api/schema";

export type Me = components["schemas"]["MeResponse"];
export type Role = Me["role"];
export type Permissions = Me["permissions"];

export const meKey = ["auth", "me"] as const;

/**
 * The signed-in user, or undefined until known. The server never knows it (it is fetched in the browser), so while
 * React hydrates server-rendered HTML this reports "not loaded" even if the browser already has the answer cached;
 * role-dependent text and controls then appear right after hydration instead of making the first client render
 * disagree with the server's HTML.
 */
export function useMe(): { data: Me | undefined } {
  const { data } = useQuery({
    queryKey: meKey,
    queryFn: ({ signal }) => request(api.GET("/api/v1/auth/me", { signal })),
    staleTime: 5 * 60_000,
  });
  return { data: useHydrated() ? data : undefined };
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
