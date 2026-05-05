import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCategory,
  createWork,
  deleteCategory,
  deleteWork,
  renameCategory,
  updateWork,
} from "../src/core/library-actions";
import {
  createEmptyLibrary,
  CURRENT_SCHEMA_VERSION,
  type Library,
} from "../src/core/model";

const now = "2026-05-05T02:00:00.000Z";

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

  it("deletes a work and removes ranking references", () => {
    const next = deleteWork(libraryWithCategory(), "work-a");

    expect(next.works.map((work) => work.id)).toEqual(["work-b"]);
    expect(next.rankings[0].workIds).toEqual([]);
  });
});
