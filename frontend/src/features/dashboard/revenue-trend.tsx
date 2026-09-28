"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

import type { Dashboard } from "./api";
import { ChartCard, ChartEmpty, ChartTooltip } from "./chart-card";
import { bucketLabel, bucketTitle, formatMoneyCompact } from "./format";

const SERIES = "var(--chart-1)";

/** Closed-won revenue per week or month of the period: one series, so one hue and no legend. */
export function RevenueTrend({ trend, bucket, periodLabel }: { trend: Dashboard["trend"]; bucket: "WEEK" | "MONTH"; periodLabel: string }) {
  const total = trend.reduce((sum, point) => sum + point.wonAmount, 0);
  const data = trend.map((point) => ({ ...point, label: bucketLabel(point.periodStart, bucket) }));
  return (
    <ChartCard
      title="Closed-won revenue"
      description={`${bucket === "WEEK" ? "By week" : "By month"} · ${periodLabel.toLowerCase()}`}
      empty={
        total === 0 ? (
          <ChartEmpty title="No closed-won revenue in this period" description="Deals marked Closed won appear here by the date they closed." />
        ) : undefined
      }
      chart={
        <div className="h-64" data-testid="revenue-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={(value: number) => formatMoneyCompact(value)}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={({ active, payload }) => {
                  const point = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
                  if (!point) return null;
                  return (
                    <ChartTooltip
                      title={bucketTitle(point.periodStart, bucket)}
                      rows={[
                        { label: "won", value: formatCurrency(point.wonAmount), color: SERIES },
                        { label: point.wonCount === 1 ? "deal" : "deals", value: String(point.wonCount), color: SERIES, faded: true },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="wonAmount" name="Closed-won revenue" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <div className="max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{bucket === "WEEK" ? "Week" : "Month"}</TableHead>
                <TableHead className="text-right">Deals won</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trend.map((point) => (
                <TableRow key={point.periodStart}>
                  <TableCell>{bucketTitle(point.periodStart, bucket)}</TableCell>
                  <TableCell className="text-right tabular-nums">{point.wonCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(point.wonAmount, { precise: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      }
    />
  );
}
