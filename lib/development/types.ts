export type DevelopmentLevel = "beginner" | "improver" | "intermediate" | "advanced";
export type LearningStatus = "not_started" | "learning" | "ready_for_assessment";
export type AssessmentOutcome = "developing" | "verified";

export type PracticeLesson = {
  id: string;
  title: string;
  minutes: number;
  focus: string;
  practice: string;
  reflection: string;
};

export type DevelopmentSkill = {
  id: string;
  level: DevelopmentLevel;
  title: string;
  description: string;
  courtFocus: string;
  lessons: readonly PracticeLesson[];
};

export type Pathway = {
  id: DevelopmentLevel;
  title: string;
  description: string;
};
