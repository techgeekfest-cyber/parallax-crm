import {
  ArrowRightLeftIcon,
  CalendarIcon,
  MailIcon,
  PencilLineIcon,
  PhoneIcon,
  RefreshCwIcon,
  StickyNoteIcon,
  UserRoundCheckIcon,
  type LucideIcon,
} from "lucide-react";

import type { ActivityType } from "./api";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  NOTE: "Note",
  STAGE_CHANGE: "Stage update",
  LEAD_CONVERSION: "Lead conversion",
  ASSIGNMENT: "Assignment",
  RECORD_UPDATE: "Record update",
};

/** What people can log by hand; the other types are written by workflows only (the API enforces this). */
export const MANUAL_ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING", "NOTE"] as const satisfies readonly ActivityType[];
export type ManualActivityType = (typeof MANUAL_ACTIVITY_TYPES)[number];

export const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  CALL: PhoneIcon,
  EMAIL: MailIcon,
  MEETING: CalendarIcon,
  NOTE: StickyNoteIcon,
  STAGE_CHANGE: ArrowRightLeftIcon,
  LEAD_CONVERSION: RefreshCwIcon,
  ASSIGNMENT: UserRoundCheckIcon,
  RECORD_UPDATE: PencilLineIcon,
};

export const ACTIVITY_TONES: Record<ActivityType, string> = {
  CALL: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  EMAIL: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  MEETING: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  NOTE: "bg-muted text-muted-foreground",
  STAGE_CHANGE: "bg-primary/10 text-primary",
  LEAD_CONVERSION: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ASSIGNMENT: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  RECORD_UPDATE: "bg-muted text-muted-foreground",
};
