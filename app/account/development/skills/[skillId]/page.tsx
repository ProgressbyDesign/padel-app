import { notFound } from "next/navigation";
import SkillJourney from "@/components/development/SkillJourney";
import { sampleSkill } from "@/lib/development/samplePathways";
import { requireDevelopmentPreview } from "@/lib/development/access";

export default async function SkillPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  await requireDevelopmentPreview(`/account/development/skills/${encodeURIComponent(skillId)}`);
  const skill = sampleSkill(skillId);
  if (!skill) notFound();
  return <SkillJourney skill={skill} />;
}
