"use client";

import { useMe } from "@/features/auth/api";

import { useAssignableUsers } from "./api";

export const ALL_OWNERS = "ALL";

/**
 * Owner filter shared by record lists: "All owners", "Mine", and — for people who may see the directory — each
 * active user. The URL stores "me" or a user id; this resolves it to the id the API expects.
 */
export function useOwnerFilter(owner: string | undefined) {
  const { data: me } = useMe();
  const canPickPeople = me?.permissions.viewUsers ?? false;
  const users = useAssignableUsers(canPickPeople);
  const items: Record<string, string> = {
    [ALL_OWNERS]: "All owners",
    me: "Mine",
    ...Object.fromEntries((users.data?.content ?? []).filter((u) => u.id !== me?.id).map((u) => [u.id, u.fullName])),
  };
  const ownerId = owner === "me" ? me?.id : owner;
  return { items, ownerId, ready: owner !== "me" || !!me };
}
