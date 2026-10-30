"use client";

import Link from "next/link";
import { Check, Circle, ArrowRight } from "lucide-react";
import type { DevelopmentSkill } from "@/lib/development/types";
import { skillProgress } from "@/lib/development/progress";
import { useDevelopmentPreview } from "./DevelopmentPreviewProvider";
import { PageIntro, ProgressBar, panel, primaryAction, secondaryAction } from "./DevelopmentUi";

export default function SkillJourney({ skill }: { skill: DevelopmentSkill }) {
  const { completed, completeLesson } = useDevelopmentPreview();
  const progress = skillProgress(skill, completed);
  const nextIndex = skill.lessons.findIndex((lesson) => !completed.includes(lesson.id));
  return <>
    <Link href="/account/development" className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">← All sample skills</Link>
    <PageIntro title={skill.title} description={skill.description} />
    <div className={`${panel} mb-6`}><p className="mb-4 text-sm font-semibold capitalize">{skill.level} · {skill.courtFocus}</p><ProgressBar value={progress.percent} label={`${progress.done} of ${progress.total} lessons practised in this preview`} /><p className="mt-4 text-xs leading-5 text-primary/65">Practice completion is self-reported. It does not verify a skill or award an assessment outcome.</p></div>
    <ol className="space-y-4">{skill.lessons.map((lesson, index) => {
      const done = completed.includes(lesson.id);
      const locked = nextIndex !== -1 && index > nextIndex;
      return <li key={lesson.id} className={panel}>
        <div className="flex items-start gap-3"><span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-accent" : "bg-surface"}`} aria-hidden>{done ? <Check size={18} /> : <Circle size={14} />}</span><div><p className="text-xs font-medium text-primary/65">Lesson {index + 1} · {lesson.minutes} min practice · {done ? "Practised" : locked ? "Complete the previous lesson first" : "Ready to explore"}</p><h2 className="mt-2 text-xl">{lesson.title}</h2></div></div>
        <p className="mt-5 text-sm leading-6 text-primary/75">{lesson.focus}</p>
        <div className="mt-4 rounded-2xl bg-secondary/20 p-4"><h3 className="font-body text-sm font-semibold">Try it on court</h3><p className="mt-2 text-sm leading-6">{lesson.practice}</p><p className="mt-3 text-sm leading-6"><strong>Reflect:</strong> {lesson.reflection}</p></div>
        <button className={`${done ? secondaryAction : primaryAction} mt-5 disabled:cursor-not-allowed disabled:opacity-50`} disabled={locked || done} onClick={() => completeLesson(lesson.id)}>{done ? "Practised in preview" : "Mark practice complete"}{!done ? <ArrowRight size={16} aria-hidden /> : null}</button>
      </li>;
    })}</ol>
    <div className="sr-only" role="status">{progress.done} of {progress.total} practice lessons complete.</div>
    {progress.done === progress.total ? <section className={`${panel} mt-6 border-accent`}><h2 className="text-2xl">Practice complete. Keep building.</h2><p className="mt-3 text-sm leading-6 text-primary/70">You can revisit these drills or explore how a future coach assessment will work. This preview cannot verify your skill.</p><Link href="/account/development/assessments?intent=submit" className={`${primaryAction} mt-5`}>Explore an assessment</Link></section> : null}
  </>;
}
