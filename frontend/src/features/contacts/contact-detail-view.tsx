"use client";

import { ArchiveIcon, ArrowLeftIcon, MailIcon, PencilIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AddressBlock, DetailItem, DetailSkeleton, Empty } from "@/components/detail";
import { OwnerName } from "@/components/owner-name";
import { ArchiveButton } from "@/components/record-actions";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountTypeBadge } from "@/features/accounts/account-badges";
import { ActivityTimeline } from "@/features/activities/activity-timeline";
import { describeError, isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

import { useArchiveContact, useContact } from "./api";
import { ContactFormDialog } from "./contact-form-dialog";
import { PrimaryBadge } from "./contacts-table";

export function ContactDetailView({ id }: { id: string }) {
  const { data: contact, error, isPending, refetch } = useContact(id);
  const archive = useArchiveContact();
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Contacts
      </Link>

      {isPending ? (
        <DetailSkeleton label="Loading contact" />
      ) : error ? (
        isApiError(error, "RECORD_NOT_FOUND") || isApiError(error, "BAD_REQUEST") ? (
          <EmptyState
            icon={SearchXIcon}
            title="Contact not found"
            description="The link may be incorrect."
            action={<Button variant="outline" render={<Link href="/contacts" />} nativeButton={false}>Back to contacts</Button>}
          />
        ) : (
          <ErrorState title="Couldn't load this contact" message={describeError(error)} onRetry={() => refetch()} />
        )
      ) : (
        <>
          <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{contact.fullName}</h1>
                {contact.primary && <PrimaryBadge />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[contact.title, contact.department].filter(Boolean).join(" · ") || "No title"} at{" "}
                <Link href={`/accounts/${contact.account.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                  {contact.account.name}
                </Link>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {contact.email && (
                <Button variant="outline" render={<a href={`mailto:${contact.email}`} />} nativeButton={false}>
                  <MailIcon data-icon="inline-start" />
                  Email
                </Button>
              )}
              {contact.permissions.canEdit && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Button>
              )}
              {contact.permissions.canArchive && (
                <ArchiveButton
                  archived={contact.archived}
                  recordType="contact"
                  recordName={contact.fullName}
                  consequence={contact.primary ? "The account will no longer have a primary contact." : ""}
                  onToggle={(toArchive) => archive.mutateAsync({ id: contact.id, archive: toArchive })}
                />
              )}
            </div>
          </header>

          {contact.archived && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <ArchiveIcon className="size-4" />
              Archived {contact.archivedAt ? formatDateTime(contact.archivedAt) : ""}.
            </p>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <DetailItem label="Email">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="hover:text-primary hover:underline">
                        {contact.email}
                      </a>
                    ) : (
                      <Empty />
                    )}
                  </DetailItem>
                  <DetailItem label="Phone">{contact.phone ?? <Empty />}</DetailItem>
                  <DetailItem label="Title">{contact.title ?? <Empty />}</DetailItem>
                  <DetailItem label="Department">{contact.department ?? <Empty />}</DetailItem>
                  <DetailItem label="Account">
                    <span className="flex items-center gap-2">
                      <Link href={`/accounts/${contact.account.id}`} className="hover:text-primary hover:underline">
                        {contact.account.name}
                      </Link>
                      <AccountTypeBadge type={contact.account.type} />
                    </span>
                  </DetailItem>
                  <DetailItem label="Owner">
                    <OwnerName owner={contact.owner} />
                  </DetailItem>
                  <DetailItem label="Contact number">
                    <span className="font-mono text-xs">{contact.number}</span>
                  </DetailItem>
                </dl>
              </CardContent>
            </Card>
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Mailing address</CardTitle>
                </CardHeader>
                <CardContent>
                  <AddressBlock address={contact.mailingAddress} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Record</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4">
                    <DetailItem label="Created">{formatDateTime(contact.createdAt)}</DetailItem>
                    <DetailItem label="Last updated">{formatDateTime(contact.updatedAt)}</DetailItem>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>

          <ActivityTimeline className="mt-4" target={{ type: "contact", id: contact.id }} canLog={!contact.archived} />

          <ContactFormDialog open={editing} onOpenChange={setEditing} contact={contact} />
        </>
      )}
    </div>
  );
}
