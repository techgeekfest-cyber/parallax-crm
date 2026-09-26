"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { ApiError, isUnauthenticated } from "@/lib/api/errors";
import { loginPath } from "@/lib/safe-redirect";

/**
 * Any 401 means the session is gone (expired, signed out elsewhere, or revoked by an admin). A full page load to
 * /login also discards every cached query, so no data from the old session survives.
 */
function redirectToLogin() {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/login")) return;
  window.location.assign(loginPath(window.location.pathname + window.location.search));
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isUnauthenticated(error)) redirectToLogin();
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // The sign-in form handles its own 401 ("wrong password").
            if (isUnauthenticated(error) && !mutation.meta?.handlesUnauthenticated) redirectToLogin();
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Client errors (4xx) are answers, not glitches — retrying them only delays the message.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors closeButton position="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
