import type { Metadata } from "next";

import { LeadDetailView } from "@/features/leads/lead-detail-view";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  return <LeadDetailView id={id} />;
}
