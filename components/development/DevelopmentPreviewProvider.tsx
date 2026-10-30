"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { completeSampleLesson } from "@/lib/development/progress";
import type { DevelopmentLevel } from "@/lib/development/types";

type PreviewState = {
  level: DevelopmentLevel;
  selectLevel: (level: DevelopmentLevel) => void;
  completed: readonly string[];
  completeLesson: (id: string) => void;
  reset: () => void;
};
const PreviewContext = createContext<PreviewState | null>(null);

export function DevelopmentPreviewProvider({ children }: { children: ReactNode }) {
  const [level, selectLevel] = useState<DevelopmentLevel>("improver");
  const [completed, setCompleted] = useState<string[]>([]);
  function completeLesson(id: string) {
    setCompleted((previous) => completeSampleLesson(previous, id));
  }
  function reset() { setCompleted([]); selectLevel("improver"); }
  return <PreviewContext.Provider value={{ level, selectLevel, completed, completeLesson, reset }}>{children}</PreviewContext.Provider>;
}

export function useDevelopmentPreview() {
  const context = useContext(PreviewContext);
  if (!context) throw new Error("Development preview must be inside its provider.");
  return context;
}
