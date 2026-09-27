import type { Metadata } from "next";

import { ContactDetailView } from "@/features/contacts/contact-detail-view";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  return <ContactDetailView id={id} />;
}
