import type { Metadata } from "next";

import { AccountDetailView } from "@/features/accounts/account-detail-view";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  return <AccountDetailView id={id} />;
}
