import type { Metadata } from "next";

import { OpportunityDetailView } from "@/features/opportunities/opportunity-detail-view";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[id]">) {
  const { id } = await params;
  return <OpportunityDetailView id={id} />;
}
