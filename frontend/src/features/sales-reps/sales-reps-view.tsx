"use client";

import { PencilIcon, SearchXIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Pagination, SearchInput, TableCard } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/shell/user-menu";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMe } from "@/features/auth/api";
import { RoleBadge } from "@/features/users/role-badge";
import { describeError } from "@/lib/api/errors";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useListParams } from "@/lib/use-list-params";
import { cn } from "@/lib/utils";

import { useSalesReps, type SalesRep } from "./api";
import { CreateSalesRepDialog, EditSalesProfileDialog } from "./sales-rep-dialogs";

export function SalesRepsView() {
  const { get, page, update, setPage } = useListParams();
  const { data: me } = useMe();
  const seesTeam = me?.permissions.accessAllSalesRecords ?? false;
  const q = useDebouncedValue(get("q")?.trim() || undefined, 300);
  const { data, error, isPending, isFetching, refetch } = useSalesReps({ q, page, size: 25 });
  const [editing, setEditing] = useState<SalesRep | null>(null);
  const [creating, setCreating] = useState(false);
  const canEdit = data?.content[0]?.canEdit ?? false;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Sales reps"
        description={seesTeam ? "Territories, quotas and live performance for the sales team." : "Your quota and performance."}
        actions={
          me?.permissions.manageUsers && (
            <Button onClick={() => setCreating(true)}>
              <UserPlusIcon data-icon="inline-start" />
              Add sales rep
            </Button>
          )
        }
      />

      {seesTeam && (
        <div className="mt-6">
          <SearchInput label="Search sales reps" placeholder="Search name or email…" value={get("q") ?? ""} onChange={(value) => update({ q: value || undefined })} />
        </div>
      )}

      <TableCard refreshing={isFetching && !isPending}>
        {error && !data ? (
          <ErrorState title="Couldn't load the sales team" message={describeError(error)} onRetry={() => refetch()} />
        ) : data && data.content.length === 0 ? (
          get("q") ? (
            <EmptyState icon={SearchXIcon} title="No sales reps match" description="Try a different name or email." />
          ) : (
            <EmptyState
              icon={UsersIcon}
              title={seesTeam ? "No sales reps yet" : "You don't have a sales profile"}
              description={
                seesTeam
                  ? "Sales reps and managers appear here. Admins can add them from this page or from Users."
                  : "Sales profiles belong to sales reps and managers."
              }
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Sales rep</TableHead>
                <TableHead className="hidden md:table-cell">Territory</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Quota</TableHead>
                <TableHead className="text-right">YTD sales</TableHead>
                <TableHead className="hidden sm:table-cell">Attainment</TableHead>
                <TableHead className="hidden text-right xl:table-cell">Open pipeline</TableHead>
                <TableHead className="hidden xl:table-cell">Assigned</TableHead>
                {canEdit && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending || !data
                ? Array.from({ length: 4 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3" colSpan={8}>
                        <Skeleton className="h-9 w-96" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.content.map((rep) => (
                    <TableRow key={rep.id}>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={rep.fullName} className={cn(!rep.active && "opacity-50")} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 font-medium">
                              {rep.fullName}
                              <RoleBadge role={rep.role} />
                              {!rep.active && <span className="text-xs font-normal text-muted-foreground">Inactive</span>}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{rep.title ?? rep.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{rep.territory ?? "—"}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">
                        {rep.quota > 0 ? formatCurrency(rep.quota) : <span className="text-muted-foreground">Not set</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(rep.ytdSales)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Attainment percent={rep.attainmentPercent} />
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums xl:table-cell">
                        {formatCurrency(rep.openPipeline)}
                        <div className="text-xs text-muted-foreground">{formatCurrency(rep.weightedPipeline)} weighted</div>
                      </TableCell>
                      <TableCell className="hidden text-sm xl:table-cell">
                        <AssignedLinks rep={rep} ownRow={rep.id === me?.id} seesTeam={seesTeam} />
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${rep.fullName}'s sales profile`} onClick={() => setEditing(rep)}>
                            <PencilIcon />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
        {data && <Pagination page={data.page} size={data.size} totalElements={data.totalElements} totalPages={data.totalPages} onPage={setPage} />}
      </TableCard>

      <EditSalesProfileDialog rep={editing} onOpenChange={(open) => !open && setEditing(null)} />
      {me?.permissions.manageUsers && <CreateSalesRepDialog open={creating} onOpenChange={setCreating} />}
    </div>
  );
}

function Attainment({ percent }: { percent?: number }) {
  if (percent === undefined) return <span className="text-sm text-muted-foreground">No quota</span>;
  const width = Math.min(100, percent);
  return (
    <div className="flex min-w-32 items-center gap-2" aria-label={`${formatPercent(percent)} of quota`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", percent >= 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums">{formatPercent(percent)}</span>
    </div>
  );
}

/** Counts link to the record lists filtered to this rep (reps' own lists are already scoped to them). */
function AssignedLinks({ rep, ownRow, seesTeam }: { rep: SalesRep; ownRow: boolean; seesTeam: boolean }) {
  const owner = ownRow ? "me" : rep.id;
  const link = (path: string, count: number, one: string, many: string) => (
    <Link href={seesTeam || path === "/accounts" ? `${path}?owner=${owner}` : path} className="hover:text-primary hover:underline">
      {count} {count === 1 ? one : many}
    </Link>
  );
  return (
    <span className="flex flex-col text-xs">
      {link("/leads", rep.openLeadCount, "open lead", "open leads")}
      {link("/accounts", rep.accountCount, "account", "accounts")}
      {link("/opportunities", rep.openOpportunityCount, "open opportunity", "open opportunities")}
    </span>
  );
}
