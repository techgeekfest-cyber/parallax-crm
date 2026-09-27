"use client";

import { ArrowRightLeftIcon, BadgeCheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeError, isApiError } from "@/lib/api/errors";

import { useChangeLeadStatus, type Lead, type LeadStatus } from "./api";
import { ConvertLeadDialog } from "./convert-lead-dialog";
import { LEAD_STATUS_LABELS } from "./labels";

type WorkingStatus = Exclude<LeadStatus, "CONVERTED">;
const WORKING_STATUSES: WorkingStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED"];

/**
 * The lead's next step: qualify it, then convert it. Other status changes live in the menu. Converted leads are final,
 * so they get no actions. Whoever can open the lead may work it; the API checks again.
 */
export function LeadActions({ lead }: { lead: Lead }) {
  const changeStatus = useChangeLeadStatus();
  const [converting, setConverting] = useState(false);

  async function change(status: WorkingStatus) {
    try {
      await changeStatus.mutateAsync({ id: lead.id, status, version: lead.version });
      toast.success(`${lead.fullName} is now ${LEAD_STATUS_LABELS[status].toLowerCase()}`);
    } catch (error) {
      toast.error("Status not changed", {
        description: isApiError(error, "CONFLICT")
          ? "Someone else changed this lead first. The latest version is now shown."
          : describeError(error),
      });
    }
  }

  const converted = lead.status === "CONVERTED";
  const others = WORKING_STATUSES.filter((status) => status !== lead.status);
  return (
    <>
      {!converted && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" disabled={changeStatus.isPending} />}>
            Status
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Change status to</DropdownMenuLabel>
              {others.map((status) => (
                <DropdownMenuItem key={status} onClick={() => change(status)}>
                  {LEAD_STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {converted ? null : lead.status === "QUALIFIED" ? (
        <Button onClick={() => setConverting(true)}>
          <ArrowRightLeftIcon data-icon="inline-start" />
          Convert lead
        </Button>
      ) : lead.status !== "DISQUALIFIED" ? (
        <Button onClick={() => change("QUALIFIED")} disabled={changeStatus.isPending}>
          <BadgeCheckIcon data-icon="inline-start" />
          Qualify
        </Button>
      ) : null}
      {/* Stays mounted once the lead is Converted, so it can go on to show what the conversion created. */}
      <ConvertLeadDialog lead={lead} open={converting} onOpenChange={setConverting} />
    </>
  );
}
