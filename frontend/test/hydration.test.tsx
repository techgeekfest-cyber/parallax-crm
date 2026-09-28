import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { meKey, useMe, type Me } from "@/features/auth/api";

/** Role-dependent text, like the Opportunities page subtitle. */
function Subtitle() {
  const { data: me } = useMe();
  return <p>{me?.permissions.accessAllSalesRecords ? "Every deal in your organisation's pipeline." : "Your deals, from first contact to close."}</p>;
}

// The signed-in user as the API returns it (test fixture only).
const manager = { id: "m1", fullName: "Morgan Reyes", role: "SALES_MANAGER", permissions: { accessAllSalesRecords: true } } as unknown as Me;

describe("role-dependent text and hydration", () => {
  it("hydrates to the server's HTML even when the browser already knows the user, then shows the role's text", async () => {
    // The server never knows the user: it renders the neutral version.
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <Subtitle />
      </QueryClientProvider>,
    );

    // In the browser the user query resolved before this part of the page hydrated (e.g. a slow chunk load).
    const client = new QueryClient();
    client.setQueryData(meKey, manager);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(
        container,
        <QueryClientProvider client={client}>
          <Subtitle />
        </QueryClientProvider>,
        { onRecoverableError },
      );
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent("Every deal in your organisation's pipeline.");
  });
});
