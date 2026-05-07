import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTierListSharePayload,
  buildWorkSharePayload,
  buildRankingSharePayload,
  createTierListShareImage,
  createWorkShareImage,
  renderRankingShareSvg,
  renderTierListShareSvg,
  renderWorkShareSvg,
} from "../src/core/share-export";
import { CURRENT_SCHEMA_VERSION, type Library } from "../src/core/model";
import { getRankingWorks } from "../src/core/ranking";

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
      {
        id: "work-b",
        categoryId: "cat-film",
        title: "作品 B",
        coverImagePath: null,
        shortReview: "另一条短评",
        longReview: "",
        ratingDimensions: [
          {
            id: "story",
            name: "剧情",
            score: 10,
            weight: 2,
          },
        ],
        finalScore: 10,
        createdAt: now,
        updatedAt: now,
      },
    ],
    rankings: [
      {
        id: "ranking-film",
        categoryId: "cat-film",
        name: "作品排行",
        mode: "finalScore",
        dimensionId: null,
        workIds: ["work-b", "work-a"],
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

  it("builds a ranking payload in the displayed order", () => {
    const library = shareLibrary();
    const ranking = library.rankings[0];
    const orderedWorks = getRankingWorks(library, ranking);

    const payload = buildRankingSharePayload(library, ranking.id, orderedWorks);

    expect(payload).toMatchObject({
      variant: "long",
      rankingId: "ranking-film",
      rankingName: "作品排行",
      categoryName: "影视作品",
      sortLabel: "按最终评分",
    });
    expect(payload.items.map((item) => item.title)).toEqual([
      "作品 B",
      "作品 A",
    ]);
    expect(payload.items[0]?.scoreLabel).toBe("10 分");
    expect(payload.items[1]?.scoreLabel).toBe("8.67 分");
  });

  it("renders a long ranking export with the same order as the payload", () => {
    const library = shareLibrary();
    const ranking = library.rankings[0];
    const orderedWorks = getRankingWorks(library, ranking);
    const svg = renderRankingShareSvg(
      buildRankingSharePayload(library, ranking.id, orderedWorks),
    );

    expect(svg).toContain("作品排行");
    expect(svg.indexOf("作品 B")).toBeLessThan(svg.indexOf("作品 A"));
    expect(svg).toContain("按最终评分");
    expect(svg).toContain("作品顺位");
    expect(svg).toContain("10 分");
  });

  it("rejects empty ranking exports", () => {
    const library = {
      ...shareLibrary(),
      works: [],
      rankings: [
        {
          ...shareLibrary().rankings[0],
          workIds: [],
        },
      ],
    };

    expect(() => buildRankingSharePayload(library, "ranking-film", [])).toThrow(
      "Ranking has no works.",
    );
  });

  it("renders a tier list export with embedded cover data", () => {
    const library: Library = {
      ...shareLibrary(),
      works: shareLibrary().works.map((work) =>
        work.id === "work-a"
          ? {
              ...work,
              coverImagePath: "images/work-a.png",
            }
          : work,
      ),
      tierLists: [
        {
          id: "tier-film",
          categoryId: "cat-film",
          name: "五级分级",
          levels: [
            {
              id: "tier-1",
              name: "S",
              workIds: ["work-a"],
            },
            {
              id: "tier-2",
              name: "A",
              workIds: [],
            },
            {
              id: "tier-3",
              name: "B",
              workIds: [],
            },
            {
              id: "tier-4",
              name: "C",
              workIds: [],
            },
            {
              id: "tier-5",
              name: "D",
              workIds: [],
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    const coverImages = new Map([["work-a", "data:image/png;base64,AAAA"]]);
    const payload = buildTierListSharePayload(
      library,
      "tier-film",
      coverImages,
    );
    const svg = renderTierListShareSvg(payload);
    const image = createTierListShareImage(library, "tier-film", coverImages);

    expect(payload.tierListName).toBe("五级分级");
    expect(payload.levels[0].items[0]).toMatchObject({
      title: "作品 A",
      coverDataUrl: "data:image/png;base64,AAAA",
    });
    expect(svg).toContain("<image");
    expect(svg).toContain("作品 A");
    expect(image.id).toMatch(/^tier-film-tier-\d+$/);
  });
});
