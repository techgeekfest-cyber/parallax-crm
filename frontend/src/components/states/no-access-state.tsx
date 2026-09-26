import { LockKeyholeIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { EmptyState } from "./empty-state";

export function NoAccessState({ what = "this page" }: { what?: string }) {
  return (
    <EmptyState
      icon={LockKeyholeIcon}
      title="You don't have access"
      description={`Your role doesn't include access to ${what}. Ask an administrator if you need it.`}
      action={
        <Button variant="outline" render={<Link href="/leads" />} nativeButton={false}>
          Back to leads
        </Button>
      }
    />
  );
}
