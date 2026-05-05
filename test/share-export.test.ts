import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildWorkSharePayload,
  createWorkShareImage,
  renderWorkShareSvg,
} from "../src/core/share-export";
import { CURRENT_SCHEMA_VERSION, type Library } from "../src/core/model";

const now = "2026-05-05T03:00:00.000Z";

function shareLibrary(): Library {
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
        coverImagePath: null,
        shortReview: "短评内容",
        longReview: "第一段\n第二段",
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
        finalScore: 8.67,
        createdAt: now,
        updatedAt: now,
      },
    ],
    rankings: [],
    exportSettings: {
      workCoverTemplate: "default",
      workLongTemplate: "default",
      rankingTemplate: "default",
    },
  };
}

describe("work share export", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a cover payload without leaking the long review", () => {
    const payload = buildWorkSharePayload(shareLibrary(), "work-a", "cover");

    expect(payload).toMatchObject({
      variant: "cover",
      title: "作品 A",
      categoryName: "影视作品",
      shortReview: "短评内容",
      longReview: null,
      finalScore: 8.67,
    });
  });

  it("renders long review content only for long exports", () => {
    const coverSvg = renderWorkShareSvg(
      buildWorkSharePayload(shareLibrary(), "work-a", "cover"),
    );
    const longSvg = renderWorkShareSvg(
      buildWorkSharePayload(shareLibrary(), "work-a", "long"),
    );

    expect(coverSvg).toContain("短评内容");
    expect(coverSvg).toContain("未设置封面");
    expect(coverSvg).not.toContain("<image");
    expect(coverSvg).not.toContain("第一段");
    expect(longSvg).toContain("第一段");
    expect(longSvg).toContain("第二段");
  });

  it("creates an svg image file for a work share export", () => {
    const image = createWorkShareImage(shareLibrary(), "work-a", "cover");

    expect(image.id).toMatch(/^work-a-cover-\d+$/);
    expect(image.extension).toBe("svg");
    expect(new TextDecoder().decode(image.bytes)).toContain("作品 A");
  });
});
