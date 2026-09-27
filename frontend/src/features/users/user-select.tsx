"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAssignableUsers } from "./api";

/**
 * Picks an active user (record owner, account manager). "" means the placeholder option — "Me" for owners,
 * "None" for optional roles. Only rendered for people allowed to see the user directory.
 */
export function UserSelect({
  id,
  value,
  onChange,
  placeholder,
  enabled = true,
  current,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  enabled?: boolean;
  /** Keeps the current assignee selectable even if they are no longer active. */
  current?: { id: string; fullName: string };
}) {
  const users = useAssignableUsers(enabled);
  const options = [...(users.data?.content ?? []).map((u) => ({ id: u.id, fullName: u.fullName }))];
  if (current && !options.some((u) => u.id === current.id)) options.unshift(current);
  const items = { "": placeholder, ...Object.fromEntries(options.map((u) => [u.id, u.fullName])) };

  return (
    <Select items={items} value={value} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={users.isPending ? "Loading people…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{placeholder}</SelectItem>
        {options.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
