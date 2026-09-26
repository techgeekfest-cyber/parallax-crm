"use client";

import { ErrorState } from "@/components/states/error-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="px-4 py-16 md:px-8">
      <ErrorState message="This page failed to load. Try again, or reload the browser." onRetry={reset} />
    </div>
  );
}
