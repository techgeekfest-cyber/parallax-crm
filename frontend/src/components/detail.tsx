import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DetailItem({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm">{children}</dd>
    </div>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/** "—"-style placeholder for an empty value, with an accessible description. */
export function Empty({ label = "Not set" }: { label?: string }) {
  return <span className="text-muted-foreground">{label}</span>;
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <Skeleton className="mt-5 h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 rounded-xl lg:col-span-2" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  );
}

export function formatAddress(address?: {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string[] {
  if (!address) return [];
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  return [address.street, cityLine, address.country].filter((line): line is string => !!line);
}

export function AddressBlock({ address }: { address?: Parameters<typeof formatAddress>[0] }) {
  const lines = formatAddress(address);
  if (lines.length === 0) return <Empty />;
  return (
    <address className="text-sm whitespace-normal not-italic">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </address>
  );
}
