import type { Metadata } from "next";

import { AccountView } from "@/features/account/account-view";

export const metadata: Metadata = { title: "Account settings" };

export default function AccountPage() {
  return <AccountView />;
}
