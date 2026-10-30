"use client";

import Link from "next/link";
import { Award, ClipboardList, ShieldCheck } from "lucide-react";
import { SAMPLE_SKILLS } from "@/lib/development/samplePathways";
import { LEARNING_STATUS_LABELS, skillProgress } from "@/lib/development/progress";
import { useDevelopmentPreview } from "./DevelopmentPreviewProvider";
import { EmptyPanel, PageIntro, panel } from "./DevelopmentUi";

export default function MyPassport() {
  const { completed, level } = useDevelopmentPreview();
  return <>
    <PageIntro title="My Passport" description="One place for your learning and future coach assessments. This sample Passport shows how the record will work, without adding achievements to your account." />
    <section className="rounded-3xl bg-primary p-6 text-white sm:p-8"><ShieldCheck className="text-accent" size={30} aria-hidden /><h2 className="mt-4 text-2xl text-white">Built through practice. Verified by people.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Learning progress and assessed skills are different records. Only an appropriately approved assessor will be able to verify a skill.</p><p className="mt-5 inline-block rounded-full border border-white/30 px-3 py-2 text-xs font-semibold">Sample Passport · no verified skills recorded</p></section>
    <section className={`${panel} mt-6`}><h2 className="text-2xl">Sample skill record</h2><p className="mt-2 text-sm capitalize text-primary/65">{level} pathway · temporary practice progress</p><ul className="mt-5 divide-y divide-primary/10">{SAMPLE_SKILLS.filter((skill) => skill.level === level).map((skill) => <li key={skill.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><Link className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4" href={`/account/development/skills/${skill.id}`}>{skill.title}</Link><span className="rounded-full bg-surface px-3 py-2 text-xs font-medium">{LEARNING_STATUS_LABELS[skillProgress(skill, completed).status]}</span></li>)}</ul></section>
    <div className="mt-6 grid gap-5 md:grid-cols-2"><EmptyPanel icon={<ClipboardList size={24} />} title="Assessment history"><p>No real assessments are loaded in this preview. Future completed assessments will record the skill, assessor, date and outcome.</p><Link href="/account/development/assessments" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline">Explore assessments →</Link></EmptyPanel><EmptyPanel icon={<Award size={24} />} title="Achievements"><p>No achievements have been awarded. Learning milestones and verified skills will be shown separately.</p><p className="mt-4 rounded-xl bg-surface p-3"><strong>Future milestone example:</strong> first pathway completed. Criteria still to be agreed.</p></EmptyPanel></div>
    <section className={`${panel} mt-6`}><h2 className="text-xl">Understanding future outcomes</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><div><dt className="font-semibold">Developing</dt><dd className="mt-2 text-sm leading-6 text-primary/70">A completed coach assessment with guidance for further practice.</dd></div><div><dt className="font-semibold">Verified</dt><dd className="mt-2 text-sm leading-6 text-primary/70">An approved assessor has confirmed the skill against the agreed criteria.</dd></div></dl><p className="mt-5 text-xs text-primary/65">Both are delivered paid assessment outcomes. These descriptions are examples, not results awarded to you.</p></section>
  </>;
}
