import { describe, expect, it } from "vitest";
import { calculateFinalScore, recalculateWorkScore } from "../src/core/scoring";
import type { Work } from "../src/core/model";

describe("scoring", () => {
  it("calculates a weighted average and rounds to two decimals", () => {
    expect(
      calculateFinalScore([
        { id: "story", name: "剧情", score: 9, weight: 2 },
        { id: "music", name: "音乐", score: 8, weight: 1 },
      ]),
    ).toBe(8.67);
  });

  it("returns null when no valid dimensions exist", () => {
    expect(
      calculateFinalScore([
        { id: "story", name: "剧情", score: 9, weight: 0 },
        { id: "music", name: "音乐", score: 8, weight: -1 },
      ]),
    ).toBeNull();
  });

  it("recalculates a work final score from dimensions", () => {
    const work: Work = {
      id: "work-a",
      categoryId: "cat-film",
      title: "作品 A",
      coverImagePath: null,
      shortReview: "",
      longReview: "",
      ratingDimensions: [
        { id: "story", name: "剧情", score: 10, weight: 2 },
        { id: "music", name: "音乐", score: 8, weight: 1 },
      ],
      finalScore: null,
      createdAt: "2026-05-05T02:30:00.000Z",
      updatedAt: "2026-05-05T02:30:00.000Z",
    };

    expect(recalculateWorkScore(work).finalScore).toBe(9.33);
  });
});
