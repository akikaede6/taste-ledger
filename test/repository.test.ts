import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createLibraryRepository,
  joinDataPath,
  sanitizeExtension,
  sanitizePathSegment,
} from "../src/core/repository";
import { CURRENT_SCHEMA_VERSION, type Library } from "../src/core/model";
import { createNodeFileBackend } from "../src/platform/node-backend";

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
        shortReview: "",
        longReview: "",
        ratingDimensions: [],
        finalScore: null,
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

function multiRootLibrary(): Library {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    categories: [
      {
        id: "cat-film",
        parentCategoryId: null,
        name: "影视作品",
        createdAt: now,
        updatedAt: now,
        ratingDimensionTemplates: [],
      },
      {
        id: "cat-film-2026-01",
        parentCategoryId: "cat-film",
        name: "2026年1月新番",
        createdAt: now,
        updatedAt: now,
        ratingDimensionTemplates: [],
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
        shortReview: "",
        longReview: "",
        ratingDimensions: [],
        finalScore: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "work-b",
        categoryId: "cat-film-2026-01",
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
      {
        id: "work-c",
        categoryId: "cat-music",
        title: "作品 C",
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
        workIds: ["work-a", "work-b"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "rank-music",
        categoryId: "cat-music",
        name: "音乐排行",
        mode: "finalScore",
        dimensionId: null,
        workIds: ["work-c"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    tierLists: [
      {
        id: "tier-film",
        categoryId: "cat-film",
        name: "五级分级",
        levels: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "tier-music",
        categoryId: "cat-music",
        name: "音乐分级",
        levels: [],
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

describe("library repository", () => {
  it("creates missing directories and persists the library atomically", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);

    await repository.ensureStructure();
    await repository.save(sampleLibrary());

    const manifestPath = join(root, "library-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const categoryPath = join(root, "categories", "cat-film.json");
    const categoryShard = JSON.parse(await readFile(categoryPath, "utf8"));

    expect(manifest).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      rootCategoryIds: ["cat-film"],
      exportSettings: sampleLibrary().exportSettings,
    });
    expect(categoryShard).toMatchObject({
      category: sampleLibrary().categories[0],
      childCategories: [],
      works: sampleLibrary().works,
      rankings: [],
      tierLists: [],
    });
    await expect(access(join(root, "categories"))).resolves.toBeUndefined();
    await expect(access(join(root, "images"))).resolves.toBeUndefined();
    await expect(access(join(root, "exports"))).resolves.toBeUndefined();
  });

  it("stores one shard per root category and keeps shared child content in the parent shard", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);

    await repository.save(multiRootLibrary());

    const manifest = JSON.parse(
      await readFile(join(root, "library-manifest.json"), "utf8"),
    );
    const filmShard = JSON.parse(
      await readFile(join(root, "categories", "cat-film.json"), "utf8"),
    );
    const musicShard = JSON.parse(
      await readFile(join(root, "categories", "cat-music.json"), "utf8"),
    );

    expect(manifest.rootCategoryIds).toEqual(["cat-film", "cat-music"]);
    expect(filmShard).toMatchObject({
      category: {
        id: "cat-film",
      },
      childCategories: [
        {
          id: "cat-film-2026-01",
          parentCategoryId: "cat-film",
        },
      ],
      works: [
        {
          id: "work-a",
          categoryId: "cat-film",
        },
        {
          id: "work-b",
          categoryId: "cat-film-2026-01",
        },
      ],
      rankings: [
        {
          id: "rank-film",
          categoryId: "cat-film",
        },
      ],
      tierLists: [
        {
          id: "tier-film",
          categoryId: "cat-film",
        },
      ],
    });
    expect(musicShard).toMatchObject({
      category: {
        id: "cat-music",
      },
      childCategories: [],
      works: [
        {
          id: "work-c",
          categoryId: "cat-music",
        },
      ],
      rankings: [
        {
          id: "rank-music",
          categoryId: "cat-music",
        },
      ],
      tierLists: [
        {
          id: "tier-music",
          categoryId: "cat-music",
        },
      ],
    });
  });

  it("loads a previously saved library", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);

    await repository.save(sampleLibrary());
    const result = await repository.load();

    expect(result.status).toBe("loaded");
    expect(result.library).toMatchObject(sampleLibrary());
  });

  it("returns a fresh library when the json file is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);

    const result = await repository.load();

    expect(result.status).toBe("missing");
    expect(result.library.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("throws on invalid json without overwriting the bad file", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);
    const manifestPath = join(root, "library-manifest.json");

    await writeFile(manifestPath, "{broken json", "utf8");

    await expect(repository.load()).rejects.toThrow("Invalid JSON file.");
    await expect(readFile(manifestPath, "utf8")).resolves.toBe("{broken json");
  });

  it("stores image bytes under the images directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);

    const relativePath = await repository.storeImage({
      id: "work a cover",
      extension: ".PNG",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    expect(relativePath).toBe("images/work_a_cover.png");
    expect(await backend.readBytes(relativePath)).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
  });

  it("stores export bytes under the exports directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);

    const relativePath = await repository.storeExport({
      kind: "works",
      id: "work a cover",
      extension: ".SVG",
      bytes: new Uint8Array([9, 8, 7]),
    });

    expect(relativePath).toBe("exports/works/work_a_cover.svg");
    expect(await backend.readBytes(relativePath)).toEqual(
      new Uint8Array([9, 8, 7]),
    );
  });

  it("stores ranking export bytes under the ranking export directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);

    const relativePath = await repository.storeExport({
      kind: "rankings",
      id: "ranking a long",
      extension: ".SVG",
      bytes: new Uint8Array([5, 4, 3]),
    });

    expect(relativePath).toBe("exports/rankings/ranking_a_long.svg");
    expect(await backend.readBytes(relativePath)).toEqual(
      new Uint8Array([5, 4, 3]),
    );
  });

  it("normalizes path segments", () => {
    expect(joinDataPath("images", "a", "b.png")).toBe("images/a/b.png");
    expect(sanitizePathSegment("work a/cover")).toBe("work_a_cover");
    expect(sanitizeExtension(".JpG")).toBe("jpg");
  });
});
