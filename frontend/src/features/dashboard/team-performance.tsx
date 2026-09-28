"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

import type { Dashboard } from "./api";
import { formatRate } from "./format";
import { Meter } from "./kpi";

/**
 * Sales people in scope, best year-to-date first. A rep only ever sees their own row — the API decides that, this
 * component just renders what it is given.
 */
/** Rows shown before "Show all": the best performers, without turning the dashboard into a directory. */
const INITIAL_ROWS = 8;

export function TeamPerformance({ team, organisation, periodLabel }: { team: Dashboard["team"]; organisation: boolean; periodLabel: string }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? team.rows : team.rows.slice(0, INITIAL_ROWS);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{organisation ? "Team performance" : "Performance"}</CardTitle>
        <CardDescription>
          Year-to-date sales against annual quota; won and win rate for {periodLabel.toLowerCase()}.
          {team.total > team.rows.length && ` Showing the top ${team.rows.length} of ${team.total}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {team.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No sales reps or managers yet. Add them from Users or Sales reps to see their performance here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Performance by sales rep">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-44 pl-4">Rep</TableHead>
                  <TableHead className="text-right">YTD sales</TableHead>
                  <TableHead className="min-w-36">Quota attainment</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                  <TableHead className="text-right">Open pipeline</TableHead>
                  <TableHead className="pr-4 text-right">Weighted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.rep.id}>
                    <TableCell className="max-w-56 pl-4">
                      <p className="truncate font-medium" title={row.rep.fullName}>
                        {row.rep.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[row.role === "SALES_MANAGER" ? "Sales manager" : "Sales rep", row.territory].filter(Boolean).join(" · ")}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.ytdSales)}</TableCell>
                    <TableCell>
                      {row.quota === undefined ? (
                        <span className="text-xs text-muted-foreground">No quota set</span>
                      ) : (
                        <div className="min-w-32">
                          <p className="flex justify-between gap-2 text-xs tabular-nums">
                            <span className="font-medium">{formatRate(row.attainmentPercent)}</span>
                            <span className="text-muted-foreground">of {formatCurrency(row.quota)}</span>
                          </p>
                          <Meter percent={row.attainmentPercent ?? 0} label={`${row.rep.fullName} quota attainment`} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.wonAmount)}
                      <span className="block text-xs text-muted-foreground">
                        {row.wonCount} {row.wonCount === 1 ? "deal" : "deals"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRate(row.winRatePercent)}
                      <span className="block text-xs text-muted-foreground">
                        {row.winRatePercent === undefined ? "none closed" : `${row.wonCount} of ${row.wonCount + row.lostCount}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.openAmount)}
                      <span className="block text-xs text-muted-foreground">{row.openCount} open</span>
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatCurrency(row.weightedAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {team.rows.length > INITIAL_ROWS && (
              <div className="border-t px-4 pt-3">
                <Button variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? "Show top performers only" : `Show all ${team.rows.length}`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
