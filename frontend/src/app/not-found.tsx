import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <div className="text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">The link may be broken, or the page may have moved.</p>
        <Button className="mt-6" render={<Link href="/leads" />} nativeButton={false}>
          Go to Leads
        </Button>
      </div>
    </main>
  );
}
