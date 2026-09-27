"use client";

import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeError } from "@/lib/api/errors";

/** Archive (with confirmation) or restore a record. Rendered only for roles that may; the API enforces it too. */
export function ArchiveButton({
  archived,
  recordType,
  recordName,
  consequence,
  onToggle,
}: {
  archived: boolean;
  recordType: string;
  recordName: string;
  /** What archiving means for this record type, shown in the confirmation. */
  consequence: string;
  onToggle: (archive: boolean) => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function run(archive: boolean) {
    setPending(true);
    try {
      await onToggle(archive);
      toast.success(archive ? `${recordName} archived` : `${recordName} restored`);
      setConfirming(false);
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setPending(false);
    }
  }

  if (archived) {
    return (
      <Button variant="outline" onClick={() => run(false)} disabled={pending}>
        <ArchiveRestoreIcon data-icon="inline-start" />
        {pending ? "Restoring…" : "Restore"}
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <ArchiveIcon data-icon="inline-start" />
        Archive
      </Button>
      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive this {recordType}?</DialogTitle>
            <DialogDescription>
              {recordName} will be hidden from lists and can no longer be edited. {consequence} You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => run(true)} disabled={pending}>
              {pending ? "Archiving…" : `Archive ${recordType}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Shown when a save hits 409 CONFLICT: someone else changed the record while it was open. */
export function ConflictNotice({ onReload }: { onReload: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2">
      <p className="text-sm text-destructive">Someone else changed this record while you were editing.</p>
      <Button type="button" size="sm" variant="outline" onClick={onReload}>
        Reload
      </Button>
    </div>
  );
}
