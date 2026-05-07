import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCategory,
  createRanking,
  createTierList,
  createWork,
  deleteCategory,
  deleteTierList,
  deleteWork,
  moveRankingWork,
  moveTierListWork,
  removeTierListWork,
  renameCategory,
  updateCategoryRatingDimensions,
  updateWork,
} from "../src/core/library-actions";
import {
  createEmptyLibrary,
  CURRENT_SCHEMA_VERSION,
  type Library,
} from "../src/core/model";

const now = "2026-05-05T02:00:00.000Z";

const rankingNow = "2026-05-05T02:30:00.000Z";

function libraryWithCategory(): Library {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    categories: [
      {
        id: "cat-film",
        name: "影视作品",
        createdAt: now,
        updatedAt: now,
        ratingDimensionTemplates: [
          {
            id: "story",
            name: "剧情",
            weight: 2,
          },
          {
            id: "music",
            name: "音乐",
            weight: 1,
          },
        ],
      },
    ],
    works: [
      {
        id: "work-a",
        categoryId: "cat-film",
        title: "作品 A",
        coverImagePath: null,
        shortReview: "",
        longReview: "",
        ratingDimensions: [],
        finalScore: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "work-b",
        categoryId: "cat-other",
        title: "作品 B",
        coverImagePath: null,
        shortReview: "",
        longReview: "",
        ratingDimensions: [],
        finalScore: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    rankings: [
      {
        id: "ranking-film",
        categoryId: "cat-film",
        name: "从夯到拉",
        mode: "finalScore",
        dimensionId: null,
        workIds: ["work-a"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "ranking-other",
        categoryId: "cat-other",
        name: "其他",
        mode: "finalScore",
        dimensionId: null,
        workIds: ["work-b"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    tierLists: [],
    exportSettings: {
      workCoverTemplate: "default",
      workLongTemplate: "default",
      rankingTemplate: "default",
    },
  };
}

function rankingLibrary(): Library {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    categories: [
      {
        id: "cat-film",
        name: "影视作品",
        createdAt: now,
        updatedAt: now,
        ratingDimensionTemplates: [
          {
            id: "story",
            name: "剧情",
            weight: 1,
          },
        ],
      },
    ],
    works: [
      {
        id: "work-a",
        categoryId: "cat-film",
        title: "作品 A",
        coverImagePath: null,
        shortReview: "",
        longReview: "",
        ratingDimensions: [
          {
            id: "story",
            name: "剧情",
            score: 7,
            weight: 1,
          },
        ],
        finalScore: 8,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "work-b",
        categoryId: "cat-film",
        title: "作品 B",
        coverImagePath: null,
        shortReview: "",
        longReview: "",
        ratingDimensions: [
          {
            id: "story",
            name: "剧情",
            score: 9,
            weight: 1,
          },
        ],
        finalScore: 6,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "work-c",
        categoryId: "cat-film",
        title: "作品 C",
        coverImagePath: null,
        shortReview: "",
        longReview: "",
        ratingDimensions: [
          {
            id: "story",
            name: "剧情",
            score: 8,
            weight: 1,
          },
        ],
        finalScore: 7,
        createdAt: now,
        updatedAt: now,
      },
    ],
    rankings: [],
    tierLists: [],
    exportSettings: {
      workCoverTemplate: "default",
      workLongTemplate: "default",
      rankingTemplate: "default",
    },
  };
}

describe("category actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a trimmed category with timestamps", () => {
    vi.setSystemTime(new Date(now));

    const next = createCategory(createEmptyLibrary(), { name: "  音乐  " });

    expect(next.categories).toHaveLength(1);
    expect(next.categories[0]).toMatchObject({
      name: "音乐",
      createdAt: now,
      updatedAt: now,
    });
  });

  it("rejects empty category names", () => {
    expect(() => createCategory(createEmptyLibrary(), { name: "   " })).toThrow(
      "Category name cannot be empty.",
    );
  });

  it("renames a category", () => {
    vi.setSystemTime(new Date("2026-05-05T02:10:00.000Z"));

    const next = renameCategory(libraryWithCategory(), "cat-film", "电影");

    expect(next.categories[0]).toMatchObject({
      id: "cat-film",
      name: "电影",
      updatedAt: "2026-05-05T02:10:00.000Z",
    });
  });

  it("deletes a category and related works and rankings", () => {
    const next = deleteCategory(libraryWithCategory(), "cat-film");

    expect(next.categories.map((category) => category.id)).not.toContain(
      "cat-film",
    );
    expect(next.works.map((work) => work.id)).toEqual(["work-b"]);
    expect(next.rankings.map((ranking) => ranking.id)).toEqual([
      "ranking-other",
    ]);
  });

  it("creates a work with inherited rating dimensions", () => {
    vi.setSystemTime(new Date(now));

    const result = createWork(libraryWithCategory(), {
      categoryId: "cat-film",
      title: "  作品 C  ",
    });

    expect(result.work).toMatchObject({
      title: "作品 C",
      categoryId: "cat-film",
      shortReview: "",
      longReview: "",
      finalScore: 0,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.work.ratingDimensions).toEqual([
      {
        id: "story",
        name: "剧情",
        score: 0,
        weight: 2,
      },
      {
        id: "music",
        name: "音乐",
        score: 0,
        weight: 1,
      },
    ]);
  });

  it("updates work title and reviews independently", () => {
    vi.setSystemTime(new Date("2026-05-05T02:20:00.000Z"));

    const next = updateWork(libraryWithCategory(), "work-a", {
      title: "作品 A 改",
      shortReview: "短评",
      longReview: "第一段\n第二段",
    });

    expect(next.works[0]).toMatchObject({
      title: "作品 A 改",
      shortReview: "短评",
      longReview: "第一段\n第二段",
      updatedAt: "2026-05-05T02:20:00.000Z",
    });
  });

  it("updates rating dimensions and recalculates the final score", () => {
    vi.setSystemTime(new Date("2026-05-05T02:25:00.000Z"));

    const next = updateWork(libraryWithCategory(), "work-a", {
      ratingDimensions: [
        {
          id: "story",
          name: "剧情",
          score: 9,
          weight: 2,
        },
        {
          id: "music",
          name: "音乐",
          score: 8,
          weight: 1,
        },
      ],
    });

    expect(next.works[0]).toMatchObject({
      finalScore: 8.67,
      updatedAt: "2026-05-05T02:25:00.000Z",
    });
  });

  it("updates category rating dimensions and syncs category works", () => {
    vi.setSystemTime(new Date("2026-05-05T02:26:00.000Z"));

    const next = updateCategoryRatingDimensions(rankingLibrary(), "cat-film", [
      {
        id: "story",
        name: "故事",
        weight: 2,
      },
      {
        id: "music",
        name: "音乐",
        weight: 1,
      },
    ]);

    expect(next.categories[0].ratingDimensionTemplates).toEqual([
      {
        id: "story",
        name: "故事",
        weight: 2,
      },
      {
        id: "music",
        name: "音乐",
        weight: 1,
      },
    ]);
    expect(next.works[0].ratingDimensions).toEqual([
      {
        id: "story",
        name: "故事",
        score: 7,
        weight: 2,
      },
      {
        id: "music",
        name: "音乐",
        score: 0,
        weight: 1,
      },
    ]);
    expect(next.works[0].finalScore).toBe(4.67);
  });

  it("rejects invalid rating dimensions", () => {
    expect(() =>
      updateCategoryRatingDimensions(libraryWithCategory(), "cat-film", [
        {
          id: "story",
          name: "剧情",
          weight: -1,
        },
      ]),
    ).toThrow("Rating dimension 1 weight must be valid.");

    expect(() =>
      updateWork(libraryWithCategory(), "work-a", {
        ratingDimensions: [
          {
            id: "story",
            name: "剧情",
            score: Number.NaN,
            weight: 1,
          },
        ],
      }),
    ).toThrow("Rating dimension 1 score must be valid.");

    expect(() =>
      updateWork(libraryWithCategory(), "work-a", {
        ratingDimensions: [
          {
            id: "acting",
            name: "演出",
            score: 9,
            weight: 1,
          },
        ],
      }),
    ).toThrow("Rating dimension 1 must belong to the category.");
  });

  it("creates a ranking sorted by final score", () => {
    vi.setSystemTime(new Date(rankingNow));

    const result = createRanking(rankingLibrary(), {
      categoryId: "cat-film",
      name: "从夯到拉",
      mode: "finalScore",
    });

    expect(result.ranking).toMatchObject({
      name: "从夯到拉",
      mode: "finalScore",
      dimensionId: null,
      createdAt: rankingNow,
      updatedAt: rankingNow,
    });
    expect(result.ranking.workIds).toEqual(["work-a", "work-c", "work-b"]);
  });

  it("creates a ranking sorted by a single dimension", () => {
    vi.setSystemTime(new Date(rankingNow));

    const result = createRanking(rankingLibrary(), {
      categoryId: "cat-film",
      name: "剧情排行",
      mode: "dimension",
      dimensionId: "story",
    });

    expect(result.ranking.workIds).toEqual(["work-b", "work-c", "work-a"]);
  });

  it("refreshes automatic rankings when a work score changes", () => {
    vi.setSystemTime(new Date(rankingNow));

    const next = updateWork(
      {
        ...rankingLibrary(),
        rankings: [
          {
            id: "ranking-film",
            categoryId: "cat-film",
            name: "从夯到拉",
            mode: "finalScore",
            dimensionId: null,
            workIds: ["work-a", "work-c", "work-b"],
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      "work-b",
      {
        ratingDimensions: [
          {
            id: "story",
            name: "剧情",
            score: 10,
            weight: 1,
          },
        ],
      },
    );

    expect(next.rankings[0].workIds).toEqual(["work-b", "work-a", "work-c"]);
    expect(next.rankings[0].updatedAt).toBe(rankingNow);
  });

  it("moves a work within a manual ranking", () => {
    vi.setSystemTime(new Date(rankingNow));

    const next = moveRankingWork(
      {
        ...rankingLibrary(),
        rankings: [
          {
            id: "ranking-manual",
            categoryId: "cat-film",
            name: "手动排行",
            mode: "manual",
            dimensionId: null,
            workIds: ["work-a", "work-b", "work-c"],
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      "ranking-manual",
      "work-b",
      -1,
    );

    expect(next.rankings[0].workIds).toEqual(["work-b", "work-a", "work-c"]);
    expect(next.rankings[0].updatedAt).toBe(rankingNow);
  });

  it("creates and edits a five-level tier list", () => {
    vi.setSystemTime(new Date(rankingNow));

    const created = createTierList(rankingLibrary(), {
      categoryId: "cat-film",
      name: "五档分级",
    });

    expect(created.tierList).toMatchObject({
      name: "五档分级",
      categoryId: "cat-film",
      createdAt: rankingNow,
      updatedAt: rankingNow,
    });
    expect(created.tierList.levels.map((level) => level.name)).toEqual([
      "S",
      "A",
      "B",
      "C",
      "D",
    ]);

    const moved = moveTierListWork(
      created.library,
      created.tierList.id,
      "work-b",
      "tier-1",
    );
    expect(moved.tierLists[0].levels[0].workIds).toEqual(["work-b"]);

    const removed = removeTierListWork(moved, created.tierList.id, "work-b");
    expect(removed.tierLists[0].levels[0].workIds).toEqual([]);

    const deleted = deleteTierList(removed, created.tierList.id);
    expect(deleted.tierLists).toEqual([]);
  });

  it("deletes a work and removes ranking references", () => {
    const next = deleteWork(libraryWithCategory(), "work-a");

    expect(next.works.map((work) => work.id)).toEqual(["work-b"]);
    expect(next.rankings[0].workIds).toEqual([]);
  });
});
