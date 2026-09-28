"use client";

import { KanbanIcon, LayoutDashboardIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";

import { FilterSelect } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth/api";
import { useOwnerFilter } from "@/features/users/owner-filter";
import { describeError } from "@/lib/api/errors";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useListParams } from "@/lib/use-list-params";
import { cn } from "@/lib/utils";

import { useDashboard, type Dashboard } from "./api";
import { ForecastChart } from "./forecast";
import { DEFAULT_RANGE, formatMoneyCompact, formatRate, parseRange, periodSummary, RANGE_LABELS, RANGES } from "./format";
import { KpiTile, Meter } from "./kpi";
import { RevenueTrend } from "./revenue-trend";
import { StageBreakdown } from "./stage-breakdown";
import { TeamPerformance } from "./team-performance";

// The default period first: FilterSelect treats its first item as "no filter", which keeps the default out of the URL.
const RANGE_ITEMS = Object.fromEntries([DEFAULT_RANGE, ...RANGES.filter((r) => r !== DEFAULT_RANGE)].map((r) => [r, RANGE_LABELS[r]]));

/**
 * The sales state at a glance. Every figure comes from GET /api/v1/dashboard, computed by the server over what the
 * viewer may see; the period and owner filters are sent to the server, never applied here.
 */
export function DashboardView() {
  const { get, update } = useListParams();
  const { data: me } = useMe();
  const seesAll = me?.permissions.accessAllSalesRecords ?? false;
  const owner = useOwnerFilter(seesAll ? get("owner") : undefined);
  const range = parseRange(get("range"));
  const dashboard = useDashboard({ range, ownerId: owner.ownerId }, { enabled: owner.ready });
  const data = dashboard.data;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Dashboard"
        description={data ? <ScopeLine data={data} /> : "Your sales at a glance."}
        actions={
          <Button variant="outline" render={<Link href="/pipeline" />} nativeButton={false}>
            <KanbanIcon data-icon="inline-start" />
            Open pipeline
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <FilterSelect label="Reporting period" items={RANGE_ITEMS} value={get("range")} onChange={(value) => update({ range: value })} />
        {seesAll && <FilterSelect label="Filter by owner" items={owner.items} value={get("owner")} onChange={(value) => update({ owner: value })} />}
        {dashboard.isFetching && !dashboard.isPending && (
          <span role="status" className="text-xs text-muted-foreground">
            Updating…
          </span>
        )}
      </div>

      {dashboard.error && !data ? (
        <div className="mt-6 rounded-xl border bg-card">
          <ErrorState title="Couldn't load the dashboard" message={describeError(dashboard.error)} onRetry={() => dashboard.refetch()} />
        </div>
      ) : (
        // Refetching keeps the previous figures on screen, dimmed, instead of flashing skeletons.
        <div className={cn("transition-opacity", dashboard.isFetching && !dashboard.isPending && "opacity-60")} aria-busy={dashboard.isFetching}>
          {data && isEmptyWorkspace(data) && <GettingStarted scope={data.scope} meId={me?.id} />}
          <HeadlineKpis data={data} />
          <SecondaryKpis data={data} />
          {data ? (
            <>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <RevenueTrend trend={data.trend} bucket={data.period.bucket} periodLabel={RANGE_LABELS[data.period.range]} />
                <ForecastChart forecast={data.forecast} />
              </div>
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Pipeline by stage</CardTitle>
                  <CardDescription>Value and number of deals in each stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <StageBreakdown stages={data.stages} periodLabel={RANGE_LABELS[data.period.range]} />
                </CardContent>
              </Card>
              <div className="mt-4">
                <TeamPerformance team={data.team} organisation={data.scope.organisation} periodLabel={RANGE_LABELS[data.period.range]} />
              </div>
            </>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2" aria-label="Loading charts">
              <Skeleton className="h-80 rounded-xl" />
              <Skeleton className="h-80 rounded-xl" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScopeLine({ data }: { data: Dashboard }) {
  const whose = data.scope.organisation ? "Your organisation" : data.scope.owner ? `${data.scope.owner.fullName}` : "Your figures";
  return (
    <>
      {whose} · {RANGE_LABELS[data.period.range]} ({periodSummary(data.period.from, data.period.to)})
    </>
  );
}

function isEmptyWorkspace(data: Dashboard) {
  const r = data.records;
  return r.leads === 0 && r.accounts === 0 && r.contacts === 0 && r.opportunities === 0;
}

function GettingStarted({ scope, meId }: { scope: Dashboard["scope"]; meId?: string }) {
  const title = scope.organisation
    ? "No sales data yet"
    : !scope.owner || scope.owner.id === meId
      ? "You have no sales data yet"
      : `${scope.owner.fullName} has no sales data yet`;
  return (
    <div className="mt-6 rounded-xl border bg-card">
      <EmptyState
        icon={LayoutDashboardIcon}
        title={title}
        description="The dashboard fills in as leads, accounts and opportunities are created and deals move through the pipeline. Nothing here is estimated."
        action={
          <Button render={<Link href="/leads" />} nativeButton={false}>
            <UsersRoundIcon data-icon="inline-start" />
            Go to leads
          </Button>
        }
      />
    </div>
  );
}

/** The four figures a sales team reads first. */
function HeadlineKpis({ data }: { data?: Dashboard }) {
  const period = data ? RANGE_LABELS[data.period.range].toLowerCase() : "";
  const o = data?.outcomes;
  const p = data?.pipeline;
  return (
    <section aria-label="Key figures" className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiTile
        label="Open pipeline"
        value={p && formatMoneyCompact(p.openAmount)}
        context={p && `${formatNumber(p.openCount)} open ${p.openCount === 1 ? "deal" : "deals"} · ${formatCurrency(p.openAmount)}`}
        empty={p && p.openCount === 0 ? "No open deals" : undefined}
        hint="Total amount of every open deal (not closed won or lost) right now."
      />
      <KpiTile
        label="Weighted pipeline"
        value={p && formatMoneyCompact(p.weightedAmount)}
        context={p && `Amount × probability · ${formatCurrency(p.weightedAmount)}`}
        empty={p && p.openCount === 0 ? "No open deals" : undefined}
        hint="Each open deal's amount multiplied by its win probability, summed: what the pipeline is likely to be worth."
      />
      <KpiTile
        label="Closed-won revenue"
        value={o && formatMoneyCompact(o.wonAmount)}
        context={o && `${formatNumber(o.wonCount)} ${o.wonCount === 1 ? "deal" : "deals"} won · ${period}`}
        empty={o && o.wonCount === 0 ? `No deals won · ${period}` : undefined}
        hint="Total amount of deals marked Closed won during the selected period."
      />
      <KpiTile
        label="Win rate"
        value={o && formatRate(o.winRatePercent)}
        context={o && `${o.wonCount} won · ${o.lostCount} lost · ${period}`}
        empty={o && o.winRatePercent === undefined ? `No closed deals yet · ${period}` : undefined}
        hint="Deals won ÷ deals closed (won + lost) during the selected period. Needs at least one closed deal."
      />
    </section>
  );
}

/** Supporting figures, smaller: deal size, quota and the size of the book. */
function SecondaryKpis({ data }: { data?: Dashboard }) {
  const period = data ? RANGE_LABELS[data.period.range].toLowerCase() : "";
  const o = data?.outcomes;
  const q = data?.quota;
  const r = data?.records;
  return (
    <section aria-label="More figures" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiTile
        size="sm"
        label="Average deal size"
        value={o && (o.averageDealSize === undefined ? "—" : formatMoneyCompact(o.averageDealSize))}
        context={o?.averageDealSize !== undefined ? "Mean of deals won" : undefined}
        empty={o && o.averageDealSize === undefined ? "No deals won yet" : undefined}
        hint="Average amount of the deals marked Closed won during the selected period. Open and lost deals are not included."
      />
      <KpiTile
        size="sm"
        label="Quota attainment"
        value={q && formatRate(q.attainmentPercent)}
        context={q && q.quota !== undefined ? `${formatMoneyCompact(q.ytdSales)} of ${formatMoneyCompact(q.quota)} · ${q.year}` : undefined}
        empty={q && q.quota === undefined ? "No quota set" : undefined}
        hint="Closed-won revenue this calendar year against the annual quota of the sales people in scope. Quotas are set on Sales reps."
      >
        {q?.attainmentPercent !== undefined && <Meter percent={q.attainmentPercent} label="Quota attainment" />}
      </KpiTile>
      <KpiTile
        size="sm"
        label="Leads"
        value={r && formatNumber(r.leads)}
        context={r && `${formatNumber(r.openLeads)} open · ${formatNumber(r.newLeads)} new`}
        hint="Active leads; open ones are not yet converted or disqualified. New = created during the selected period."
      />
      <KpiTile size="sm" label="Accounts" value={r && formatNumber(r.accounts)} context="Active" hint="Active (not archived) accounts in scope." />
      <KpiTile size="sm" label="Contacts" value={r && formatNumber(r.contacts)} context="Active" hint="Active (not archived) contacts in scope." />
      <KpiTile
        size="sm"
        label="Opportunities"
        value={r && formatNumber(r.opportunities)}
        context={r && `${formatNumber(r.newOpportunities)} new · ${period}`}
        hint="Active opportunities in any stage. New = created during the selected period."
      />
    </section>
  );
}
