import type { Metadata } from "next";
import { Suspense } from "react";

import { LeadsView } from "@/features/leads/leads-view";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  // LeadsView reads its state from the URL (useSearchParams), which requires a Suspense boundary.
  return (
    <Suspense>
      <LeadsView />
    </Suspense>
  );
}
