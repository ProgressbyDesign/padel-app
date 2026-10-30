"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { recommendedSkill, skillProgress } from "@/lib/development/progress";
import { useDevelopmentPreview } from "./DevelopmentPreviewProvider";
import { PageIntro, panel, primaryAction, secondaryAction } from "./DevelopmentUi";

export default function MyNextStep() {
  const { level, completed } = useDevelopmentPreview();
  const skill = recommendedSkill(level, completed);
  const progress = skillProgress(skill, completed);
  const nextLesson = skill.lessons.find((lesson) => !completed.includes(lesson.id));
  return <>
    <PageIntro title="My Next Step" description="Keep it simple: one thing to focus on, one practice to try, one useful step forward." />
    <section className="rounded-3xl bg-primary p-6 text-white sm:p-8"><ArrowUpRight size={30} className="text-accent" aria-hidden /><p className="mt-5 text-sm font-semibold text-accent">Suggested from your sample pathway</p><h2 className="mt-3 text-3xl text-white">{nextLesson ? nextLesson.title : "Take your practice a little further"}</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/80">{nextLesson ? `${skill.title} · ${nextLesson.minutes} minutes. ${nextLesson.focus}` : "You have practised this pathway's sample lessons. Revisit them on court or explore a future coach assessment."}</p><Link href={`/account/development/skills/${skill.id}`} className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{progress.done === 0 ? "Start this practice" : "Return to the skill"} →</Link></section>
    <div className="mt-6 grid gap-5 md:grid-cols-2"><section className={panel}><h2 className="text-2xl">A coach&apos;s perspective</h2><p className="mt-3 text-sm leading-6 text-primary/70">When you feel ready, a future assessment can help you understand what is developing and what to practise next.</p><Link href="/account/development/assessments?intent=submit" className={`${primaryAction} mt-5`}>Explore an assessment</Link></section><section className={panel}><h2 className="text-2xl">Make time on court</h2><p className="mt-3 text-sm leading-6 text-primary/70">Find a coach for your next session or a venue where you can put the practice into play.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/coaches" className={secondaryAction}>Find a coach</Link><Link href="/venues" className={secondaryAction}>Explore venues</Link></div></section></div>
  </>;
}
