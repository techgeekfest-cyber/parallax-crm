"use client";

import { useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { useAccounts } from "./api";
import { ACCOUNT_TYPE_LABELS } from "./labels";

export type AccountOption = { id: string; name: string };

/** Searches active accounts on the server as you type (only 20 results at a time, so it scales). */
export function AccountPicker({
  id,
  value,
  onChange,
  invalid,
  disabled,
}: {
  id: string;
  value: AccountOption | null;
  onChange: (account: AccountOption | null) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 250);
  const { data, isFetching } = useAccounts({ q: q || undefined, page: 0, size: 20, sort: "name,asc" });
  const items = (data?.content ?? []).map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
  }));

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(next) => onChange(next ? { id: next.id, name: next.name } : null)}
      onInputValueChange={(next) => setQuery(next)}
      filter={null}
      itemToStringLabel={(item) => item.name}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      disabled={disabled}
    >
      <ComboboxInput id={id} placeholder="Search accounts…" aria-invalid={invalid} className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>{isFetching ? "Searching…" : "No active accounts match."}</ComboboxEmpty>
        <ComboboxList>
          {(item: (typeof items)[number]) => (
            <ComboboxItem key={item.id} value={item}>
              <span className="truncate">{item.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[item.type]}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
