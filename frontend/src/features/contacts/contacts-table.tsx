"use client";

import { StarIcon } from "lucide-react";
import Link from "next/link";

import { SortableHead } from "@/components/data-table";
import { OwnerName } from "@/components/owner-name";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { ContactSummary } from "./api";

export const CONTACT_DEFAULT_SORT = "lastName,asc";

export function PrimaryBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/25 ring-inset">
      <StarIcon className="size-3 fill-current" aria-hidden="true" />
      Primary
    </span>
  );
}

export function ContactsTable({
  contacts,
  loading,
  sort,
  onSort,
  showAccount = true,
}: {
  contacts?: ContactSummary[];
  loading: boolean;
  sort?: string;
  onSort?: (sort: string | undefined) => void;
  showAccount?: boolean;
}) {
  const sortable = (field: string, label: string, className?: string) =>
    onSort ? (
      <SortableHead field={field} label={label} sort={sort} defaultSort={CONTACT_DEFAULT_SORT} onSort={onSort} className={className} />
    ) : (
      <TableHead className={className}>{label}</TableHead>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {sortable("lastName", "Contact")}
          {showAccount && <TableHead className="hidden sm:table-cell">Account</TableHead>}
          {sortable("title", "Title", "hidden md:table-cell")}
          <TableHead className="hidden lg:table-cell">Phone</TableHead>
          <TableHead className="hidden lg:table-cell">Owner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading || !contacts
          ? Array.from({ length: 4 }, (_, i) => (
              <TableRow key={i}>
                <TableCell className="py-3" colSpan={5}>
                  <Skeleton className="h-8 w-72" />
                </TableCell>
              </TableRow>
            ))
          : contacts.map((contact) => (
              <TableRow key={contact.id} className="group relative">
                <TableCell className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium after:absolute after:inset-0 focus-visible:outline-none group-hover:text-primary"
                    >
                      {contact.fullName}
                    </Link>
                    {contact.primary && <PrimaryBadge />}
                  </div>
                  <div className="text-xs text-muted-foreground">{contact.email ?? contact.number}</div>
                </TableCell>
                {showAccount && (
                  <TableCell className="relative z-10 hidden sm:table-cell">
                    <Link href={`/accounts/${contact.account.id}`} className="hover:text-primary hover:underline">
                      {contact.account.name}
                    </Link>
                  </TableCell>
                )}
                <TableCell className="hidden text-muted-foreground md:table-cell">{contact.title ?? "—"}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{contact.phone ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  <OwnerName owner={contact.owner} />
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
