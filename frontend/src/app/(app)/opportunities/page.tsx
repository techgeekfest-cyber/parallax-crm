import type { Metadata } from "next";
import { Suspense } from "react";

import { OpportunitiesView } from "@/features/opportunities/opportunities-view";

export const metadata: Metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  // List state lives in the URL (useSearchParams), which requires a Suspense boundary.
  return (
    <Suspense>
      <OpportunitiesView />
    </Suspense>
  );
}
