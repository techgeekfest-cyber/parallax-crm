"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Activity = components["schemas"]["ActivityResponse"];
export type ActivityType = Activity["type"];
export type ActivityRequest = components["schemas"]["ActivityRequest"];

/** The record a timeline belongs to. */
export type TimelineTarget = { type: "lead" | "account" | "contact" | "opportunity"; id: string };

const PAGE_SIZE = 20;

export const activityKeys = {
  all: ["activities"] as const,
  timeline: (target: TimelineTarget) => [...activityKeys.all, target.type, target.id] as const,
};

function targetQuery(target: TimelineTarget) {
  return { [`${target.type}Id`]: target.id } as Pick<ActivityRequest, "leadId" | "accountId" | "contactId" | "opportunityId">;
}

/** A record's timeline, newest first, loaded a page at a time. */
export function useTimeline(target: TimelineTarget) {
  return useInfiniteQuery({
    queryKey: activityKeys.timeline(target),
    queryFn: ({ pageParam, signal }) =>
      request(api.GET("/api/v1/activities", { params: { query: { ...targetQuery(target), page: pageParam, size: PAGE_SIZE } }, signal })),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });
}

export function useLogActivity(target: TimelineTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<ActivityRequest, "leadId" | "accountId" | "contactId" | "opportunityId">) =>
      request(api.POST("/api/v1/activities", { body: { ...body, ...targetQuery(target) } })),
    // The server decides order and content: refetch rather than splice the new entry in.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: activityKeys.timeline(target) }),
  });
}

/** After a workflow step (stage change, conversion …) the affected timelines have new system entries. */
export function invalidateTimelines(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: activityKeys.all });
}
