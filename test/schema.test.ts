import { describe, expect, it } from "vitest";
import {
  assertValidLibrary,
  createEmptyLibrary,
  CURRENT_SCHEMA_VERSION,
  type Library,
  validateLibrary,
} from "../src/core";

const now = "2026-05-04T09:30:00.000Z";

function sampleLibrary(): Library {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    categories: [
      {
        id: "cat-film",
        parentCategoryId: null,
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
      {
        id: "cat-music",
        parentCategoryId: null,
        name: "音乐",
        createdAt: now,
        updatedAt: now,
        ratingDimensionTemplates: [],
      },
    ],
    works: [
      {
        id: "work-a",
        categoryId: "cat-film",
        title: "作品 A",
        coverImagePath: "images/work-a.png",
        tags: [],
        shortReview: "短评",
        longReview: "长评",
        ratingDimensions: [
          {
            id: "story",
            name: "剧情",
            score: 9,
            weight: 2,
          },
        ],
        finalScore: 9,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "work-b",
        categoryId: "cat-music",
        title: "作品 B",
        coverImagePath: null,
        tags: [],
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
        id: "rank-film",
        categoryId: "cat-film",
        name: "作品排行",
        mode: "finalScore",
        dimensionId: null,
        workIds: ["work-a"],
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

describe("library schema", () => {
  it("creates an empty versioned library", () => {
    expect(createEmptyLibrary()).toEqual({
      schemaVersion: 1,
      categories: [],
      works: [],
      rankings: [],
      tierLists: [],
      exportSettings: {
        workCoverTemplate: "default",
        workLongTemplate: "default",
        rankingTemplate: "default",
      },
    });
  });

  it("accepts a complete portable library", () => {
    const result = validateLibrary(sampleLibrary());

    expect(result.ok).toBe(true);
    expect(result.value?.schemaVersion).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it("rejects missing required fields", () => {
    const result = validateLibrary({
      schemaVersion: 1,
      categories: [{}],
      works: [],
      rankings: [],
      exportSettings: {
        workCoverTemplate: "default",
        workLongTemplate: "default",
        rankingTemplate: "default",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toContain(
      "$.categories[0].name",
    );
  });

  it("rejects works that reference missing categories", () => {
    const library = sampleLibrary();
    library.works[0] = {
      ...library.works[0],
      categoryId: "missing",
    };

    const result = validateLibrary(library);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.works[0].categoryId",
          message: "Work references a missing category.",
        }),
      ]),
    );
  });

  it("rejects non-portable cover image paths", () => {
    const library = sampleLibrary();
    library.works[0] = {
      ...library.works[0],
      coverImagePath: "/tmp/picker-image.png",
    };

    const result = validateLibrary(library);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.works[0].coverImagePath",
          message: "Cover image path must be a relative path under images/.",
        }),
      ]),
    );
  });

  it("rejects negative weights and non-numeric scores", () => {
    const library = sampleLibrary();
    const raw = structuredClone(library) as unknown as Record<string, unknown>;
    const works = raw.works as Array<Record<string, unknown>>;
    works[0].ratingDimensions = [
      {
        id: "story",
        name: "剧情",
        score: "great",
        weight: -1,
      },
    ];

    const result = validateLibrary(raw);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "$.works[0].ratingDimensions[0].score",
        "$.works[0].ratingDimensions[0].weight",
      ]),
    );
  });

  it("rejects rankings that include works from another category", () => {
    const library = sampleLibrary();
    library.rankings[0] = {
      ...library.rankings[0],
      workIds: ["work-a", "work-b"],
    };

    const result = validateLibrary(library);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.rankings[0].workIds[1]",
          message: "Ranking cannot include works outside its category tree.",
        }),
      ]),
    );
  });

  it("accepts child category works that share root dimensions and rankings", () => {
    const library = sampleLibrary();
    library.categories.push({
      id: "cat-film-2026-01",
      parentCategoryId: "cat-film",
      name: "2026年1月新番",
      createdAt: now,
      updatedAt: now,
      ratingDimensionTemplates: [],
    });
    library.works[0] = {
      ...library.works[0],
      categoryId: "cat-film-2026-01",
      tags: ["新番", "原创"],
    };
    library.rankings[0] = {
      ...library.rankings[0],
      categoryId: "cat-film",
      workIds: ["work-a"],
    };

    const result = validateLibrary(library);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects rating dimensions defined directly on child categories", () => {
    const library = sampleLibrary();
    library.categories.push({
      id: "cat-film-2026-01",
      parentCategoryId: "cat-film",
      name: "2026年1月新番",
      createdAt: now,
      updatedAt: now,
      ratingDimensionTemplates: [
        {
          id: "story-child",
          name: "剧情",
          weight: 1,
        },
      ],
    });

    const result = validateLibrary(library);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.categories[2].ratingDimensionTemplates",
          message: "Only root categories may define shared rating dimensions.",
        }),
      ]),
    );
  });

  it("rejects subcategories nested below another subcategory", () => {
    const library = sampleLibrary();
    library.categories.push({
      id: "cat-film-2026-01",
      parentCategoryId: "cat-film",
      name: "2026年1月新番",
      createdAt: now,
      updatedAt: now,
      ratingDimensionTemplates: [],
    });
    library.categories.push({
      id: "cat-film-2026-01-a",
      parentCategoryId: "cat-film-2026-01",
      name: "第 1 周",
      createdAt: now,
      updatedAt: now,
      ratingDimensionTemplates: [],
    });

    const result = validateLibrary(library);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.categories[3].parentCategoryId",
          message: "Subcategories may only be one level deep.",
        }),
      ]),
    );
  });

  it("throws a typed validation error when assertion fails", () => {
    expect(() => assertValidLibrary({ schemaVersion: 999 })).toThrow(
      "Expected schema version 1.",
    );
  });
});
