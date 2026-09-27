import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

import type { Activity } from "./api";
import { ACTIVITY_ICONS, ACTIVITY_TONES, ACTIVITY_TYPE_LABELS } from "./labels";

/** Presentational timeline: type, subject, body, who and when. Entries arrive newest first from the API. */
export function ActivityList({ activities }: { activities: Activity[] }) {
  return (
    <ol className="grid gap-5" aria-label="Activity timeline">
      {activities.map((activity, index) => {
        const Icon = ACTIVITY_ICONS[activity.type];
        const last = index === activities.length - 1;
        return (
          <li key={activity.id} className="relative flex gap-3">
            {!last && <span className="absolute top-8 bottom-[-1.25rem] left-[0.9375rem] w-px bg-border" aria-hidden="true" />}
            <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-card", ACTIVITY_TONES[activity.type])}>
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium">{activity.subject}</p>
                <span className="text-xs text-muted-foreground">
                  {ACTIVITY_TYPE_LABELS[activity.type]}
                  {activity.system && " · automatic"}
                </span>
              </div>
              {activity.body && <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{activity.body}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {activity.actor?.fullName ?? "System"} · <time dateTime={activity.occurredAt}>{formatDateTime(activity.occurredAt)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
