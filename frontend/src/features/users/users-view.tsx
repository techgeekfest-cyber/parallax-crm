"use client";

import { PencilIcon, SearchIcon, SearchXIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/shell/user-menu";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { NoAccessState } from "@/components/states/no-access-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMe } from "@/features/auth/api";
import { describeError, isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

import { useUsers, type User } from "./api";
import { RoleBadge } from "./role-badge";
import { CreateUserDialog, EditUserDialog } from "./user-dialogs";

export function UsersView() {
  const { data: me } = useMe();
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(0);
  const canView = me?.permissions.viewUsers ?? false;
  const canManage = me?.permissions.manageUsers ?? false;
  const { data, error, isPending, isFetching, refetch } = useUsers({ q, page, size: 25 }, { enabled: canView });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  if (me && !canView) return <Page><NoAccessState what="the user directory" /></Page>;

  return (
    <Page>
      <PageHeader
        title="Users"
        description={canManage ? "Who can sign in, and what they can do." : "Everyone who can sign in to ParallaxCRM."}
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <UserPlusIcon data-icon="inline-start" />
              Add user
            </Button>
          )
        }
      />

      <div className="relative mt-6 w-full sm:max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search name or email…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          className="pl-8"
        />
      </div>

      <div className={cn("mt-4 overflow-hidden rounded-xl border bg-card shadow-xs", isFetching && !isPending && "opacity-70")}>
        {error && !data ? (
          isApiError(error, "PERMISSION_DENIED") ? (
            <NoAccessState what="the user directory" />
          ) : (
            <ErrorState title="Couldn't load users" message={describeError(error)} onRetry={() => refetch()} />
          )
        ) : data && data.content.length === 0 ? (
          <EmptyState icon={SearchXIcon} title="No users match" description="Try a different name or email." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
                {canManage && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending || !data
                ? Array.from({ length: 4 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3" colSpan={canManage ? 5 : 4}>
                        <Skeleton className="h-8 w-64" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.content.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.fullName} className={cn(!user.active && "opacity-50")} />
                          <div className="min-w-0">
                            <div className="font-medium">
                              {user.fullName}
                              {user.id === me?.id && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span
                            aria-hidden="true"
                            className={cn("size-1.5 rounded-full", user.active ? "bg-emerald-500" : "bg-muted-foreground/40")}
                          />
                          {user.active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${user.fullName}`}
                            onClick={() => setEditing(user)}
                          >
                            <PencilIcon />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {data.page + 1} of {data.totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages - 1} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {canManage && (
        <>
          <CreateUserDialog open={creating} onOpenChange={setCreating} />
          <EditUserDialog user={editing} isSelf={editing?.id === me?.id} onOpenChange={(open) => !open && setEditing(null)} />
        </>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>;
}
