"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

import type { Forecast } from "./api";
import { ChartCard, ChartEmpty, ChartTooltip } from "./chart-card";
import { bucketLabel, bucketTitle, formatMoneyCompact } from "./format";

// Two shades of one hue: weighted value is part of the open value, not a separate category.
const OPEN_VALUE = "color-mix(in oklch, var(--chart-1) 35%, transparent)";
const WEIGHTED = "var(--chart-1)";

/** Open deals by the month they are expected to close, with what is already overdue called out. */
export function ForecastChart({ forecast }: { forecast: Forecast }) {
  const data = forecast.months.map((m) => ({ ...m, label: bucketLabel(m.month, "MONTH") }));
  const nothing = forecast.months.every((m) => m.count === 0) && forecast.overdueCount === 0 && forecast.laterCount === 0;
  const notes = [
    forecast.overdueCount > 0 &&
      `${forecast.overdueCount} overdue (${formatCurrency(forecast.overdueAmount)}) — expected close date has passed`,
    forecast.laterCount > 0 && `${forecast.laterCount} closing later (${formatCurrency(forecast.laterAmount)})`,
  ].filter(Boolean) as string[];

  return (
    <ChartCard
      title="Expected closes"
      description="Open pipeline by expected close month"
      empty={nothing ? <ChartEmpty title="No open deals" description="Open opportunities appear here in the month they are expected to close." /> : undefined}
      footer={
        !nothing && notes.length > 0 ? (
          <ul className="mt-3 grid gap-1 text-xs text-muted-foreground">
            {notes.map((note) => (
              <li key={note} className={note.includes("overdue") ? "font-medium text-destructive" : undefined}>
                {note}
              </li>
            ))}
          </ul>
        ) : undefined
      }
      chart={
        <div className="h-64" data-testid="forecast-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
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
                  const month = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
                  if (!month) return null;
                  return (
                    <ChartTooltip
                      title={`${bucketTitle(month.month, "MONTH")} · ${month.count} ${month.count === 1 ? "deal" : "deals"}`}
                      rows={[
                        { label: "open value", value: formatCurrency(month.amount), color: WEIGHTED, faded: true },
                        { label: "weighted", value: formatCurrency(month.weightedAmount), color: WEIGHTED },
                      ]}
                    />
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                iconType="square"
                iconSize={10}
                formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
              <Bar dataKey="amount" name="Open value" fill={OPEN_VALUE} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              <Bar dataKey="weightedAmount" name="Weighted" fill={WEIGHTED} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expected close</TableHead>
              <TableHead className="text-right">Deals</TableHead>
              <TableHead className="text-right">Open value</TableHead>
              <TableHead className="text-right">Weighted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecast.overdueCount > 0 && (
              <TableRow>
                <TableCell className="font-medium text-destructive">Overdue</TableCell>
                <TableCell className="text-right tabular-nums">{forecast.overdueCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(forecast.overdueAmount, { precise: true })}</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
              </TableRow>
            )}
            {forecast.months.map((m) => (
              <TableRow key={m.month}>
                <TableCell>{bucketTitle(m.month, "MONTH")}</TableCell>
                <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(m.amount, { precise: true })}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(m.weightedAmount, { precise: true })}</TableCell>
              </TableRow>
            ))}
            {forecast.laterCount > 0 && (
              <TableRow>
                <TableCell>Later</TableCell>
                <TableCell className="text-right tabular-nums">{forecast.laterCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(forecast.laterAmount, { precise: true })}</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      }
    />
  );
}
