"use client";

import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function SearchInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-8"
      />
    </div>
  );
}

/** A filter dropdown whose "all" option maps to "no filter". */
export function FilterSelect({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  /** value → label; the first entry is the "all" option */
  items: Record<string, string>;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  className?: string;
}) {
  const allValue = Object.keys(items)[0];
  return (
    <Select
      items={items}
      value={value ?? allValue}
      onValueChange={(next) => onChange(next && next !== allValue ? next : undefined)}
    >
      <SelectTrigger aria-label={label} className={cn("w-full sm:w-44", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([itemValue, itemLabel]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {itemLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SortableHead({
  field,
  label,
  sort,
  defaultSort,
  onSort,
  align = "left",
  className,
}: {
  field: string;
  label: string;
  sort?: string;
  /** "field,direction" used when the URL has no sort */
  defaultSort: string;
  onSort: (sort: string | undefined) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const [sortField, direction = "asc"] = (sort ?? defaultSort).split(",");
  const active = sortField === field;
  const Icon = !active ? ChevronsUpDownIcon : direction === "desc" ? ArrowDownIcon : ArrowUpIcon;
  // Cycle: ascending → descending → back to the default order.
  const next = !active ? `${field},asc` : direction === "desc" ? undefined : `${field},desc`;

  return (
    <TableHead
      className={cn(align === "right" && "text-right", className)}
      aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(next)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

export function Pagination({
  page,
  size,
  totalElements,
  totalPages,
  onPage,
}: {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = page * size + 1;
  const to = Math.min(totalElements, (page + 1) * size);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        <span className="tabular-nums">
          {from}–{to}
        </span>{" "}
        of <span className="tabular-nums">{totalElements.toLocaleString("en-US")}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>
          Next
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}

/** The bordered card every list table sits in; dims while a refetch is in flight. */
export function TableCard({ refreshing, children }: { refreshing?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("mt-4 overflow-hidden rounded-xl border bg-card shadow-xs transition-opacity", refreshing && "opacity-70")}>
      {children}
    </div>
  );
}
