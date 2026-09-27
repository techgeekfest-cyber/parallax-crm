import { cn } from "@/lib/utils";

export function OwnerName({ owner }: { owner?: { fullName: string; active: boolean } }) {
  if (!owner) return <span className="text-muted-foreground">Unassigned</span>;
  return (
    <span className={cn(!owner.active && "text-muted-foreground")}>
      {owner.fullName}
      {!owner.active && " (inactive)"}
    </span>
  );
}
