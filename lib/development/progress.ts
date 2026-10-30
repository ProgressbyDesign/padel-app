import { SAMPLE_SKILLS } from "./samplePathways";
import type { DevelopmentLevel, DevelopmentSkill, LearningStatus } from "./types";

export function skillProgress(skill: DevelopmentSkill, completed: readonly string[]) {
  const done = skill.lessons.filter((lesson) => completed.includes(lesson.id)).length;
  const total = skill.lessons.length;
  const status: LearningStatus = done === 0 ? "not_started" : done === total ? "ready_for_assessment" : "learning";
  return { done, total, percent: total ? Math.round(done / total * 100) : 0, status };
}

export function completeSampleLesson(completed: readonly string[], lessonId: string): string[] {
  const skill = SAMPLE_SKILLS.find((item) => item.lessons.some((lesson) => lesson.id === lessonId));
  if (!skill) return [...completed];
  const index = skill.lessons.findIndex((lesson) => lesson.id === lessonId);
  if (skill.lessons.slice(0, index).some((lesson) => !completed.includes(lesson.id))) return [...completed];
  return completed.includes(lessonId) ? [...completed] : [...completed, lessonId];
}

export function recommendedSkill(level: DevelopmentLevel, completed: readonly string[]) {
  const skills = SAMPLE_SKILLS.filter((skill) => skill.level === level);
  return skills.find((skill) => skillProgress(skill, completed).done < skill.lessons.length) ?? skills[0];
}

export const LEARNING_STATUS_LABELS: Record<LearningStatus, string> = {
  not_started: "Not started", learning: "Learning", ready_for_assessment: "Practice complete",
};
