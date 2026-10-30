import Link from "next/link";
import type { ReactNode } from "react";
import { LEARNING_STATUS_LABELS, skillProgress } from "@/lib/development/progress";
import type { DevelopmentSkill } from "@/lib/development/types";

export const primaryAction = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-accent transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
export const secondaryAction = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white px-5 py-3 text-sm font-semibold text-primary transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
export const panel = "rounded-3xl border border-primary/10 bg-white p-5 sm:p-7";

export function PageIntro({ title, description }: { title: string; description: string }) {
  return <header className="mb-7"><p className="mb-2 text-sm font-semibold text-primary/65">Padel Progress Passport</p><h1 className="text-3xl sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-primary/70">{description}</p></header>;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return <div><div className="mb-2 flex justify-between gap-3 text-xs font-medium"><span>{label}</span><span>{value}%</span></div><progress aria-label={label} max={100} value={value} className="block h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-surface [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" /></div>;
}

export function SkillCard({ skill, completed }: { skill: DevelopmentSkill; completed: readonly string[] }) {
  const progress = skillProgress(skill, completed);
  return <article className={`${panel} flex h-full flex-col`}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-primary/65">{skill.courtFocus}</span><span className="rounded-full bg-secondary/35 px-3 py-1.5 font-medium">{LEARNING_STATUS_LABELS[progress.status]}</span></div>
    <h3 className="mt-5 text-2xl">{skill.title}</h3><p className="mb-6 mt-3 flex-1 text-sm leading-6 text-primary/70">{skill.description}</p>
    <ProgressBar value={progress.percent} label={`${progress.done} of ${progress.total} practice lessons`} />
    <Link href={`/account/development/skills/${skill.id}`} className={`${secondaryAction} mt-5`}>{progress.done === 0 ? "Explore skill" : progress.status === "ready_for_assessment" ? "Revisit practice" : "Continue practice"}<span aria-hidden>→</span></Link>
  </article>;
}

export function EmptyPanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className={`${panel} flex flex-col items-start`}><span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/30 text-primary" aria-hidden>{icon}</span><h2 className="text-2xl">{title}</h2><div className="mt-3 text-sm leading-6 text-primary/70">{children}</div></section>;
}
