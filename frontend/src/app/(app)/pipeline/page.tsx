import type { Metadata } from "next";
import { Suspense } from "react";

import { PipelineView } from "@/features/pipeline/pipeline-view";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  // Filters live in the URL (useSearchParams), which requires a Suspense boundary.
  return (
    <Suspense>
      <PipelineView />
    </Suspense>
  );
}
