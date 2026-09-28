"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, request } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Dashboard = components["schemas"]["DashboardResponse"];
export type AnalyticsRange = Dashboard["period"]["range"];
export type StageFigure = components["schemas"]["StageBreakdownResponse"];
export type TrendPoint = components["schemas"]["TrendPointResponse"];
export type Forecast = components["schemas"]["ForecastResponse"];
export type RepPerformance = components["schemas"]["RepPerformanceResponse"];

export type DashboardParams = { range: AnalyticsRange; ownerId?: string };

export const dashboardKeys = {
  all: ["dashboard"] as const,
  view: (params: DashboardParams) => [...dashboardKeys.all, params] as const,
};

/**
 * Every figure on the dashboard, from one request. The backend computes all of it with SQL over what the viewer may
 * see; this hook only fetches. While a new period or owner loads, the previous figures stay on screen.
 */
export function useDashboard(params: DashboardParams, { enabled = true } = {}) {
  return useQuery({
    queryKey: dashboardKeys.view(params),
    queryFn: ({ signal }) => request(api.GET("/api/v1/dashboard", { params: { query: params }, signal })),
    placeholderData: keepPreviousData,
    // A live view: any page can change these figures (a stage move, a conversion, a new quota), so every visit asks
    // the server again. Cached figures show, dimmed, until the fresh ones arrive.
    staleTime: 0,
    refetchOnMount: "always",
    enabled,
  });
}
