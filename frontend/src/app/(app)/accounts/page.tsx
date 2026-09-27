import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountsView } from "@/features/accounts/accounts-view";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  // List state lives in the URL (useSearchParams), which requires a Suspense boundary.
  return (
    <Suspense>
      <AccountsView />
    </Suspense>
  );
}
