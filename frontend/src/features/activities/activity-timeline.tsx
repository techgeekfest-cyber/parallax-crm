"use client";

import { ActivityIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

import { useTimeline, type TimelineTarget } from "./api";
import { ActivityList } from "./activity-list";
import { LogActivityForm } from "./log-activity-form";

/**
 * A record's activity timeline — logged calls, emails, meetings and notes plus the workflow events the system records —
 * read from the API. `canLog` only hides the button; the API decides who may log.
 */
export function ActivityTimeline({ target, canLog, className }: { target: TimelineTarget; canLog: boolean; className?: string }) {
  const timeline = useTimeline(target);
  const [logging, setLogging] = useState(false);
  const activities = timeline.data?.pages.flatMap((page) => page.content) ?? [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        {canLog && !logging && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setLogging(true)}>
              <PlusIcon data-icon="inline-start" />
              Log activity
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-5">
        {logging && <LogActivityForm target={target} onDone={() => setLogging(false)} />}
        {timeline.isPending ? (
          <div className="grid gap-4" aria-busy="true" aria-label="Loading activity">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : timeline.error && activities.length === 0 ? (
          <ErrorState title="Couldn't load activity" message={describeError(timeline.error)} onRetry={() => timeline.refetch()} />
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <ActivityIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">No activity yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Calls, emails, meetings, notes and workflow changes appear here.</p>
          </div>
        ) : (
          <>
            <ActivityList activities={activities} />
            {timeline.hasNextPage && (
              <Button
                variant="ghost"
                size="sm"
                className={cn("justify-self-center", timeline.isFetchingNextPage && "opacity-60")}
                onClick={() => timeline.fetchNextPage()}
                disabled={timeline.isFetchingNextPage}
              >
                {timeline.isFetchingNextPage ? "Loading…" : "Show older activity"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
