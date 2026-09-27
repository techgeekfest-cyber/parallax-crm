"use client";

import Link from "next/link";

import { SortableHead } from "@/components/data-table";
import { OwnerName } from "@/components/owner-name";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCalendarDate, formatCurrency } from "@/lib/format";

import type { OpportunitySummary } from "./api";
import { StageBadge } from "./stage-badge";

export const OPPORTUNITY_DEFAULT_SORT = "closeDate,asc";

export function OpportunitiesTable({
  opportunities,
  loading,
  sort,
  onSort,
  showAccount = true,
  showOwner = true,
}: {
  opportunities?: OpportunitySummary[];
  loading: boolean;
  sort?: string;
  onSort?: (sort: string | undefined) => void;
  showAccount?: boolean;
  showOwner?: boolean;
}) {
  const sortable = (field: string, label: string, className?: string, align?: "left" | "right") =>
    onSort ? (
      <SortableHead
        field={field}
        label={label}
        sort={sort}
        defaultSort={OPPORTUNITY_DEFAULT_SORT}
        onSort={onSort}
        className={className}
        align={align}
      />
    ) : (
      <TableHead className={className}>{label}</TableHead>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {sortable("name", "Opportunity")}
          {showAccount && <TableHead className="hidden md:table-cell">Account</TableHead>}
          <TableHead>Stage</TableHead>
          {sortable("amount", "Amount", "text-right", "right")}
          {sortable("probability", "Prob.", "hidden text-right lg:table-cell", "right")}
          {sortable("closeDate", "Close date", "hidden sm:table-cell")}
          {showOwner && <TableHead className="hidden xl:table-cell">Owner</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading || !opportunities
          ? Array.from({ length: 4 }, (_, i) => (
              <TableRow key={i}>
                <TableCell className="py-3" colSpan={7}>
                  <Skeleton className="h-8 w-80" />
                </TableCell>
              </TableRow>
            ))
          : opportunities.map((opportunity) => (
              <TableRow key={opportunity.id} className="group relative">
                <TableCell className="py-3">
                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    className="font-medium after:absolute after:inset-0 focus-visible:outline-none group-hover:text-primary"
                  >
                    {opportunity.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    <span className="md:hidden">{opportunity.account.name}</span>
                    <span className="hidden font-mono md:inline">{opportunity.number}</span>
                  </div>
                </TableCell>
                {showAccount && (
                  <TableCell className="relative z-10 hidden md:table-cell">
                    <Link href={`/accounts/${opportunity.account.id}`} className="hover:text-primary hover:underline">
                      {opportunity.account.name}
                    </Link>
                  </TableCell>
                )}
                <TableCell>
                  <StageBadge stage={opportunity.stage} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(opportunity.amount)}</TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums lg:table-cell">
                  {opportunity.probability}%
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {formatCalendarDate(opportunity.closeDate)}
                </TableCell>
                {showOwner && (
                  <TableCell className="hidden xl:table-cell">
                    <OwnerName owner={opportunity.owner} />
                  </TableCell>
                )}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
