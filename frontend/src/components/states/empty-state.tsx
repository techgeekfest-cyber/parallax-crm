import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      <div className="relative mb-5 size-12">
        {/* Offset layers echo the Parallax mark. */}
        <div className="absolute inset-0 translate-x-1.5 -translate-y-1.5 rounded-xl bg-primary/15" />
        <div className="relative grid size-12 place-items-center rounded-xl border bg-card shadow-xs">
          <Icon className="size-5 text-primary" />
        </div>
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
