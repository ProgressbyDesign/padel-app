import type { CoachApplicationStatus } from "@/lib/coachProfileApplication/constants";

export const ADMIN_EDITABLE_COACH_APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "changes_requested",
] as const satisfies readonly CoachApplicationStatus[];

export function canEditCoachApplication(status: string): boolean {
  return (
    ADMIN_EDITABLE_COACH_APPLICATION_STATUSES as readonly string[]
  ).includes(status);
}

export type CoachApplicationEditResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};
