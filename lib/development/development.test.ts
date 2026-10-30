import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeSampleLesson, recommendedSkill, skillProgress } from "./progress";
import { SAMPLE_PATHWAYS, SAMPLE_SKILLS, sampleSkill } from "./samplePathways";
import { developmentPreviewEnabled } from "./flags";
import { requireDevelopmentPreview } from "./access";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedAccount: mocks.auth }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("PADEL_PASSPORT_PREVIEW", "true");
  mocks.auth.mockReset().mockResolvedValue({ id: "test-player", email: "player@example.invalid" });
});
afterEach(() => vi.unstubAllEnvs());

describe("Passport preview access", () => {
  it("requires local development and explicit opt-in", () => {
    expect(developmentPreviewEnabled()).toBe(true);
    vi.stubEnv("PADEL_PASSPORT_PREVIEW", "");
    expect(developmentPreviewEnabled()).toBe(false);
  });
  it.each(["production", "test"])("stays closed in %s even with the flag set", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    expect(developmentPreviewEnabled()).toBe(false);
    await expect(requireDevelopmentPreview()).rejects.toThrow("NOT_FOUND");
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("stays closed on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    expect(developmentPreviewEnabled()).toBe(false);
  });
  it("uses the existing authentication requirement with the requested path", async () => {
    expect(await requireDevelopmentPreview("/account/development/passport")).toEqual({ id: "test-player", email: "player@example.invalid" });
    expect(mocks.auth).toHaveBeenCalledWith("/account/development/passport");
  });
  it("propagates login redirects rather than allowing anonymous preview", async () => {
    mocks.auth.mockRejectedValue(new Error("LOGIN_REDIRECT"));
    await expect(requireDevelopmentPreview()).rejects.toThrow("LOGIN_REDIRECT");
  });
});

describe("sample learning progression", () => {
  const bandeja = sampleSkill("improver-bandeja")!;
  it("covers all four levels with unique lesson identifiers", () => {
    expect(SAMPLE_PATHWAYS.map((level) => level.title)).toEqual(["Beginner", "Improver", "Intermediate", "Advanced"]);
    expect(SAMPLE_PATHWAYS.every((level) => SAMPLE_SKILLS.some((skill) => skill.level === level.id))).toBe(true);
    const lessonIds = SAMPLE_SKILLS.flatMap((skill) => skill.lessons.map((lesson) => lesson.id));
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    expect(sampleSkill("invalid-skill")).toBeUndefined();
  });
  it("starts with no real or invented achievements", () => {
    expect(skillProgress(bandeja, [])).toEqual({ done: 0, total: 3, percent: 0, status: "not_started" });
  });
  it("advances sequentially and ignores repeated or unknown completions", () => {
    expect(completeSampleLesson([], "bandeja-recover")).toEqual([]);
    expect(completeSampleLesson([], "not-a-lesson")).toEqual([]);
    const first = completeSampleLesson([], "bandeja-position");
    expect(completeSampleLesson(first, "bandeja-position")).toEqual(first);
    expect(skillProgress(bandeja, first)).toMatchObject({ done: 1, percent: 33, status: "learning" });
    expect(first).toEqual(["bandeja-position"]);
  });
  it("practice completion never grants Developing or Verified", () => {
    const completed = bandeja.lessons.reduce((ids, lesson) => completeSampleLesson(ids, lesson.id), [] as string[]);
    expect(skillProgress(bandeja, completed)).toEqual({ done: 3, total: 3, percent: 100, status: "ready_for_assessment" });
    expect(recommendedSkill("improver", completed).id).toBe("improver-serve");
    expect(skillProgress(sampleSkill("improver-serve")!, completed).done).toBe(0);
  });
  it("keeps recommendations within the selected pathway and offers revisits when complete", () => {
    expect(recommendedSkill("beginner", []).level).toBe("beginner");
    const all = SAMPLE_SKILLS.flatMap((skill) => skill.lessons.map((lesson) => lesson.id));
    expect(recommendedSkill("advanced", all).id).toBe("advanced-transition");
  });
});
