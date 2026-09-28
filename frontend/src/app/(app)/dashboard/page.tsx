import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardView } from "@/features/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  // Period and owner filters live in the URL (useSearchParams), which requires a Suspense boundary.
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
