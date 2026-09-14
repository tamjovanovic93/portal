"use server";

import { requireTeam } from "@/lib/auth/session";
import { loadWorkTasks } from "@/app/(team)/dashboard/queries";
import type { WorkTask } from "@/components/team/MyWork";

// Tasks for the dashboard "My Work" list. The page ships only the current
// member's tasks; other members / "Everyone" are fetched on demand.
export async function listWorkTasks(assigneeId: string | "all"): Promise<WorkTask[]> {
  await requireTeam();
  return loadWorkTasks(assigneeId);
}
