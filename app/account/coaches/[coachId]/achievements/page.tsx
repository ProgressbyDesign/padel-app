import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachAchievementsManager from "@/components/account/CoachAchievementsManager";
import {
  sortCoachAchievements,
  type CoachAchievementRow,
} from "@/lib/coachAchievements";
import { loadManagedCoachShell } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Coach achievements",
  description: "Manage coach achievements.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachAchievementsPage({
  params,
}: PageProps) {
  const { coachId } = await params;
  const shell = await loadManagedCoachShell(coachId);
  if (!shell) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_achievements")
    .select("id, coach_id, title, description, year, is_highlight, created_at")
    .eq("coach_id", coachId);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[achievements] load failed:", error.message);
    }
  }

  const achievements = sortCoachAchievements(
    ((error ? [] : data) ?? []).map(
      (row): CoachAchievementRow => ({
        id: String(row.id),
        coach_id: String(row.coach_id),
        title: String(row.title),
        description: (row.description as string | null) ?? null,
        year: row.year == null ? null : Number(row.year),
        is_highlight: Boolean(row.is_highlight),
        created_at: (row.created_at as string | null) ?? null,
      })
    )
  );

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
      <CoachAchievementsManager
        coachId={coachId}
        achievements={achievements}
      />
    </section>
  );
}
