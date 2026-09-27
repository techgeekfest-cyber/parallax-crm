"use client";

import { ContactRoundIcon, PlusIcon, SearchXIcon } from "lucide-react";
import { useState } from "react";

import { FilterSelect, Pagination, SearchInput, TableCard } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { useOwnerFilter } from "@/features/users/owner-filter";
import { describeError } from "@/lib/api/errors";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useListParams } from "@/lib/use-list-params";

import { useContacts } from "./api";
import { ContactFormDialog } from "./contact-form-dialog";
import { ContactsTable } from "./contacts-table";

const STATUS_ITEMS = { active: "Active", archived: "Archived" };

export function ContactsView() {
  const { get, page, update, setPage } = useListParams();
  const archived = get("status") === "archived";
  const owner = useOwnerFilter(get("owner"));
  const q = useDebouncedValue(get("q")?.trim() || undefined, 300);
  const sort = get("sort");
  const { data, error, isPending, isFetching, refetch } = useContacts({
    q,
    ownerId: owner.ownerId,
    archived,
    page,
    size: 25,
    sort,
  });
  const [creating, setCreating] = useState(false);
  const hasFilters = !!get("q") || !!get("owner") || archived;

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon data-icon="inline-start" />
      New contact
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Contacts"
        description={
          data && (data.totalElements > 0 || hasFilters)
            ? `${data.totalElements.toLocaleString("en-US")} ${archived ? "archived" : hasFilters ? "matching" : "active"} ${data.totalElements === 1 ? "contact" : "contacts"}`
            : "The people you work with at your accounts."
        }
        actions={newButton}
      />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          label="Search contacts"
          placeholder="Search name, email, title…"
          value={get("q") ?? ""}
          onChange={(value) => update({ q: value || undefined })}
        />
        <FilterSelect label="Filter by owner" items={owner.items} value={get("owner")} onChange={(value) => update({ owner: value })} />
        <FilterSelect
          label="Filter by status"
          items={STATUS_ITEMS}
          value={archived ? "archived" : undefined}
          onChange={(value) => update({ status: value })}
          className="sm:w-32"
        />
      </div>

      <TableCard refreshing={isFetching && !isPending}>
        {error && !data ? (
          <ErrorState title="Couldn't load contacts" message={describeError(error)} onRetry={() => refetch()} />
        ) : data && data.content.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchXIcon}
              title="No contacts match"
              description="Try a different search, owner or status."
              action={
                <Button variant="outline" onClick={() => update({ q: undefined, owner: undefined, status: undefined })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ContactRoundIcon}
              title="No contacts yet"
              description="Contacts are the people at your accounts. Add one here or from an account's page."
              action={newButton}
            />
          )
        ) : (
          <ContactsTable contacts={data?.content} loading={isPending} sort={sort} onSort={(s) => update({ sort: s })} />
        )}
        {data && <Pagination page={data.page} size={data.size} totalElements={data.totalElements} totalPages={data.totalPages} onPage={setPage} />}
      </TableCard>

      <ContactFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
