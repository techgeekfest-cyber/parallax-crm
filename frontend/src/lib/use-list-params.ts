"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * List state (search, filters, sort, page) kept in the URL, so views are shareable and survive refresh and the back
 * button. Updates use the native History API, which Next.js syncs into useSearchParams without a server round trip.
 * The page is 1-based in the URL and 0-based in the returned value.
 */
export function useListParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const get = useCallback((key: string) => searchParams.get(key) ?? undefined, [searchParams]);
  const page = Math.max(0, Number(searchParams.get("page") ?? "1") - 1) || 0;

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Any change other than paging returns to the first page.
      if (!("page" in patch)) next.delete("page");
      const query = next.toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname, searchParams],
  );

  const setPage = useCallback((zeroBased: number) => update({ page: String(zeroBased + 1) }), [update]);

  return { get, page, update, setPage };
}
