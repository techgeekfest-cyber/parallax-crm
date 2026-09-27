import { cn } from "@/lib/utils";

import type { AccountTier, AccountType } from "./api";
import { ACCOUNT_TIER_LABELS, ACCOUNT_TYPE_LABELS } from "./labels";

const TYPE_STYLES: Record<AccountType, string> = {
  ENTERPRISE: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/20 dark:text-indigo-300",
  SMB: "bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-300",
  STARTUP: "bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-500/20 dark:text-fuchsia-300",
};

export function AccountTypeBadge({ type, className }: { type: AccountType; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", TYPE_STYLES[type], className)}>
      {ACCOUNT_TYPE_LABELS[type]}
    </span>
  );
}

export function AccountTierBadge({ tier }: { tier: AccountTier }) {
  const top = tier === "STRATEGIC" || tier === "LATE_STAGE" || tier === "ESTABLISHED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        top ? "bg-primary/10 text-primary ring-primary/25" : "bg-muted text-muted-foreground ring-border",
      )}
    >
      {ACCOUNT_TIER_LABELS[tier]}
    </span>
  );
}
