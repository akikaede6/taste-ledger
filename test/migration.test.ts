import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCategory,
  createRanking,
  createWork,
  updateCategoryRatingDimensions,
  updateWork,
} from "../src/core/library-actions";
import { createEmptyLibrary } from "../src/core/model";
import { createLibraryRepository } from "../src/core/repository";
import { createNodeFileBackend } from "../src/platform/node-backend";

describe("data directory migration", () => {
  it("loads the same library after copying the full data directory", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "ranking-source-"));
    const targetParent = await mkdtemp(join(tmpdir(), "ranking-target-"));
    const targetRoot = join(targetParent, "copied-data");

    const sourceBackend = createNodeFileBackend({ rootDir: sourceRoot });
    const sourceRepository = createLibraryRepository(sourceBackend);

    let library = createEmptyLibrary();
    library = createCategory(library, { name: "影视作品" });

    const created = createWork(library, {
      categoryId: library.categories[0].id,
      title: "作品 A",
    });
    library = created.library;

    library = updateCategoryRatingDimensions(
      library,
      library.categories[0].id,
      [
        {
          id: "story",
          name: "剧情",
          weight: 1,
        },
      ],
    );

    const coverPath = await sourceRepository.storeImage({
      id: created.work.id,
      extension: "png",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    library = updateWork(library, created.work.id, {
      coverImagePath: coverPath,
      shortReview: "短评内容",
      longReview: "第一段\n第二段",
      ratingDimensions: [
        {
          id: "story",
          name: "剧情",
          score: 9,
          weight: 1,
        },
      ],
    });

    library = createRanking(library, {
      categoryId: library.categories[0].id,
      name: "作品排行",
      mode: "finalScore",
    }).library;

    await sourceRepository.save(library);

    const exportPath = await sourceRepository.storeExport({
      kind: "works",
      id: "work-a-cover",
      extension: "svg",
      bytes: new Uint8Array([9, 8, 7, 6]),
    });

    await cp(sourceRoot, targetRoot, { recursive: true });

    const targetBackend = createNodeFileBackend({ rootDir: targetRoot });
    const targetRepository = createLibraryRepository(targetBackend);
    const result = await targetRepository.load();

    expect(result.status).toBe("loaded");
    expect(result.library).toMatchObject(library);
    expect(await targetBackend.readBytes(coverPath)).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
    expect(await targetBackend.readBytes(exportPath)).toEqual(
      new Uint8Array([9, 8, 7, 6]),
    );
  });
});
