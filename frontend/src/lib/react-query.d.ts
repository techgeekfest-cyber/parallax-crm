import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** The mutation shows its own message for 401 instead of redirecting to sign-in. */
      handlesUnauthenticated?: boolean;
    };
  }
}
