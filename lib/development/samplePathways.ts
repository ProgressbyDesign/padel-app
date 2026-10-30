import type { DevelopmentSkill, Pathway } from "./types";

// Development-only editorial samples. These are not a published curriculum or player records.
export const SAMPLE_PATHWAYS: readonly Pathway[] = [
  { id: "beginner", title: "Beginner", description: "Build confidence with the ball, the court and your first rallies." },
  { id: "improver", title: "Improver", description: "Find control, make space and bring more intention to your game." },
  { id: "intermediate", title: "Intermediate", description: "Connect your shots with better decisions and court position." },
  { id: "advanced", title: "Advanced", description: "Refine your patterns and adapt under pressure." },
];

export const SAMPLE_SKILLS: readonly DevelopmentSkill[] = [
  {
    id: "beginner-rally", level: "beginner", title: "Build a rally",
    description: "Start with a comfortable contact point and a repeatable swing.", courtFocus: "Baseline control",
    lessons: [{ id: "rally-contact", title: "Find your contact point", minutes: 8,
      focus: "A balanced stance makes it easier to meet the ball in front of you.",
      practice: "With a partner, rally gently down the middle. Pause after each short rally and notice where you met the ball.",
      reflection: "Which contact position felt easiest to repeat?" }],
  },
  {
    id: "improver-bandeja", level: "improver", title: "Bandeja",
    description: "Turn a defensive overhead into a calmer return to the net.", courtFocus: "Overhead control",
    lessons: [
      { id: "bandeja-position", title: "Read the lob. Find your position.", minutes: 6,
        focus: "Prepare early, turn sideways and move behind the ball with controlled steps.",
        practice: "Ask a partner for gentle lobs. Move into position and catch the ball at a comfortable height before adding a racket.",
        reflection: "Were you balanced before the ball reached you?" },
      { id: "bandeja-contact", title: "Choose control over power", minutes: 8,
        focus: "Use a comfortable contact point and a smooth swing. Keep the pace manageable.",
        practice: "Play a series of gentle bandejas towards a broad target. Reset between attempts and prioritise a repeatable contact.",
        reflection: "What changed when you slowed your swing?" },
      { id: "bandeja-recover", title: "Recover with your partner", minutes: 10,
        focus: "After the shot, recover together rather than rushing forward alone.",
        practice: "Alternate a lob and a controlled overhead with a partner. Discuss where each of you should recover after the shot.",
        reflection: "Could you recover while keeping the next ball in view?" },
    ],
  },
  {
    id: "improver-serve", level: "improver", title: "Serve with purpose",
    description: "Start the point with a dependable serve and a clear recovery.", courtFocus: "First ball",
    lessons: [{ id: "serve-target", title: "Aim for a generous target", minutes: 10,
      focus: "Build a consistent routine before trying to add speed.",
      practice: "Choose a broad legal service target. Serve gently, then practise your first recovery steps.",
      reflection: "Which routine helped you repeat your serve?" }],
  },
  {
    id: "intermediate-glass", level: "intermediate", title: "Read the back glass",
    description: "Give yourself time by understanding the rebound.", courtFocus: "Defence",
    lessons: [{ id: "glass-read", title: "Watch, wait, then move", minutes: 10,
      focus: "Read the pace of the rebound before committing to the ball.",
      practice: "Use gentle partner feeds and let the ball rebound from the back glass. Begin with catches before adding a return.",
      reflection: "Which rebounds gave you more time than you expected?" }],
  },
  {
    id: "advanced-transition", level: "advanced", title: "Own the transition",
    description: "Choose when to move forward and when to rebuild the point.", courtFocus: "Tactical decisions",
    lessons: [{ id: "transition-choice", title: "Make the move together", minutes: 12,
      focus: "Connect your decision to the quality of the ball and your partner's position.",
      practice: "Play a conditioned rally and call your decision to advance or hold. Review one decision together after each point.",
      reflection: "What information helped you decide to advance?" }],
  },
];

export function sampleSkill(id: string) {
  return SAMPLE_SKILLS.find((skill) => skill.id === id);
}
