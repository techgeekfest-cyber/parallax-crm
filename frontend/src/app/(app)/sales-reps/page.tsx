import type { Metadata } from "next";
import { Suspense } from "react";

import { SalesRepsView } from "@/features/sales-reps/sales-reps-view";

export const metadata: Metadata = { title: "Sales reps" };

export default function SalesRepsPage() {
  return (
    <Suspense>
      <SalesRepsView />
    </Suspense>
  );
}
