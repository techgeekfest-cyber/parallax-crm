import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactsView } from "@/features/contacts/contacts-view";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  // List state lives in the URL (useSearchParams), which requires a Suspense boundary.
  return (
    <Suspense>
      <ContactsView />
    </Suspense>
  );
}
