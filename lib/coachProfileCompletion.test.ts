import { describe, expect, it } from "vitest";
import {
  buildCoachCompletion,
  computeCompletionScores,
  nextRecommendedCompletionItem,
  type CompletionGroup,
} from "@/lib/coachProfileCompletion";

describe("completion scoring", () => {
  it("weights overall percentage", () => {
    const groups: CompletionGroup[] = [
      {
        id: "essential",
        title: "Essential",
        items: [
          {
            id: "a",
            label: "A",
            done: true,
            href: "/",
            weight: "essential",
          },
          {
            id: "b",
            label: "B",
            done: false,
            href: "/",
            weight: "essential",
          },
        ],
      },
      {
        id: "trust",
        title: "Trust",
        items: [
          {
            id: "c",
            label: "C",
            done: true,
            href: "/",
            weight: "trust",
          },
        ],
      },
      {
        id: "booking",
        title: "Booking",
        items: [
          {
            id: "d",
            label: "D",
            done: false,
            href: "/",
            weight: "booking",
          },
        ],
      },
    ];
    const { groupScores, overallPercent } = computeCompletionScores(groups);
    expect(groupScores.find((g) => g.id === "essential")?.percent).toBe(50);
    expect(groupScores.find((g) => g.id === "trust")?.percent).toBe(100);
    expect(groupScores.find((g) => g.id === "booking")?.percent).toBe(0);
    // 0.5*50 + 0.2*100 + 0.3*0 = 45
    expect(overallPercent).toBe(45);
  });

  it("picks first incomplete essential action", () => {
    const completion = buildCoachCompletion("coach-1", {
      name: "Ada",
      role: "Coach",
      description: null,
      experience_years: null,
      phone: null,
      email: null,
      image_url: null,
      is_approved: true,
      hasPrimaryLocation: false,
      audienceAdults: false,
      audienceJuniors: false,
      playerLevels: [],
      outcomes: [],
      imageCount: 0,
      socialCount: 0,
      achievementCount: 0,
      activeVenueCount: 0,
      availabilityLive: false,
      pricingConfigured: false,
      hasFutureSession: false,
    });
    const next = nextRecommendedCompletionItem(completion.items);
    expect(next?.id).toBe("description");
  });
});
