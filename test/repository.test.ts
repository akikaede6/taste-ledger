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

describe("library repository", () => {
  it("creates missing directories and persists the library atomically", async () => {
    const root = await mkdtemp(join(tmpdir(), "ranking-repo-"));
    const backend = createNodeFileBackend({ rootDir: root });
    const repository = createLibraryRepository(backend);

    await repository.ensureStructure();
    await repository.save(sampleLibrary());

    const libraryPath = join(root, "library.json");
    const content = await readFile(libraryPath, "utf8");

    expect(JSON.parse(content)).toMatchObject(sampleLibrary());
    await expect(access(join(root, "images"))).resolves.toBeUndefined();
    await expect(access(join(root, "exports"))).resolves.toBeUndefined();
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
    const libraryPath = join(root, "library.json");

    await writeFile(libraryPath, "{broken json", "utf8");

    await expect(repository.load()).rejects.toThrow(
      "Invalid JSON in library file.",
    );
    await expect(readFile(libraryPath, "utf8")).resolves.toBe("{broken json");
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
