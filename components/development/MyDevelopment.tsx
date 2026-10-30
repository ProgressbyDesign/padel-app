"use client";

import { SAMPLE_PATHWAYS, SAMPLE_SKILLS } from "@/lib/development/samplePathways";
import { useDevelopmentPreview } from "./DevelopmentPreviewProvider";
import { PageIntro, SkillCard } from "./DevelopmentUi";

export default function MyDevelopment() {
  const { level, selectLevel, completed } = useDevelopmentPreview();
  const pathway = SAMPLE_PATHWAYS.find((item) => item.id === level)!;
  return <>
    <PageIntro title="My Development" description="A little focus. A little practice. A game that keeps moving forward. Explore a sample pathway at your own pace." />
    <section className="mb-7 overflow-hidden rounded-3xl bg-primary p-6 sm:p-8">
      <p className="text-sm font-semibold text-accent">Your game, your starting point</p><h2 className="mt-3 max-w-lg text-2xl text-white sm:text-3xl">Make the next session count.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Start with Improver Bandeja or explore another level. Choosing a pathway is a practice preference, not a verified rating.</p>
    </section>
    <fieldset><legend className="mb-3 text-base font-semibold">Choose a sample pathway</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{SAMPLE_PATHWAYS.map((item) => <label key={item.id} className={`relative cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold ${level === item.id ? "border-primary bg-accent" : "border-primary/15 bg-white"}`}><input type="radio" name="pathway" value={item.id} checked={level === item.id} onChange={() => selectLevel(item.id)} className="peer sr-only" /><span className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary" /><span>{item.title}</span></label>)}</div></fieldset>
    <div className="mb-5 mt-7"><h2 className="text-2xl">{pathway.title} skills</h2><p className="mt-2 text-sm leading-6 text-primary/70">{pathway.description}</p><p className="mt-2 text-xs text-primary/60">Representative sample · the proposed six skills per level are not yet a full curriculum.</p></div>
    <div className="grid gap-5 md:grid-cols-2">{SAMPLE_SKILLS.filter((skill) => skill.level === level).map((skill) => <SkillCard key={skill.id} skill={skill} completed={completed} />)}</div>
  </>;
}
