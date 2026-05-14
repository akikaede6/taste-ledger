import {
  DEFAULT_TIER_LEVELS,
  type Library,
  type RankingMode,
  type RatingDimensionScore,
  type TierLevel,
  type TierLevelId,
  type Work,
} from "./model";
import { getCategoryAncestorIds } from "./category-tree";
import { createMosaicImageDataUrl } from "./image-utils";

export interface ShareCoverOptions {
  coverMosaic: boolean;
  mosaicLevel: number;
}

export type WorkShareVariant = "cover" | "long";
export type RankingShareVariant = "long";

export const DEFAULT_SHARE_COVER_OPTIONS: ShareCoverOptions = {
  coverMosaic: false,
  mosaicLevel: 3,
};

export interface WorkSharePayload {
  variant: WorkShareVariant;
  workId: string;
  title: string;
  categoryName: string;
  coverImagePath: string | null;
  coverDataUrl: string | null;
  finalScore: number | null;
  ratingDimensions: RatingDimensionScore[];
  shortReview: string | null;
  longReview: string | null;
}

export interface ShareImageFile {
  id: string;
  extension: "svg";
  bytes: Uint8Array;
}

export interface RankingShareItem {
  rank: number;
  title: string;
  scoreLabel: string;
}

export interface RankingSharePayload {
  variant: RankingShareVariant;
  rankingId: string;
  rankingName: string;
  categoryName: string;
  sortLabel: string;
  items: RankingShareItem[];
}

export interface RankingPreviewShareInput {
  categoryName: string;
  rankingName: string;
  mode: Exclude<RankingMode, "manual">;
  dimensionId: string | null;
  dimensionName: string | null;
  orderedWorks: Work[];
}

export interface TierListPreviewShareInput {
  tierListId: string;
  tierListName: string;
  categoryName: string;
  levels: TierLevel[];
  works: Work[];
  coverImages?: Map<string, string>;
}

export interface TierListShareItem {
  title: string;
  coverImagePath: string | null;
  coverDataUrl: string | null;
}

export interface TierListShareLevel {
  id: TierLevelId;
  name: string;
  items: TierListShareItem[];
}

export interface TierListSharePayload {
  variant: "tier";
  tierListId: string;
  tierListName: string;
  categoryName: string;
  levels: TierListShareLevel[];
}

const IMAGE_WIDTH = 1080;
export async function buildWorkSharePayload(
  library: Library,
  workId: string,
  variant: WorkShareVariant,
  coverDataUrl: string | null = null,
  coverOptions: ShareCoverOptions = DEFAULT_SHARE_COVER_OPTIONS,
): WorkSharePayload {
  const work = library.works.find((item) => item.id === workId);

  if (!work) {
    throw new Error("Work not found.");
  }

  const category = library.categories.find(
    (item) => item.id === work.categoryId,
  );

  if (!category) {
    throw new Error("Work category not found.");
  }

  const displayCoverDataUrl =
    coverDataUrl && coverOptions.coverMosaic
      ? await createMosaicImageDataUrl(coverDataUrl, coverOptions.mosaicLevel)
      : coverDataUrl;

  return {
    variant,
    workId: work.id,
    title: work.title,
    categoryName: category.name,
    coverImagePath: work.coverImagePath,
    coverDataUrl: displayCoverDataUrl,
    finalScore: work.finalScore,
    ratingDimensions: work.ratingDimensions,
    shortReview: trimToNull(work.shortReview),
    longReview: variant === "long" ? trimToNull(work.longReview) : null,
  };
}

export async function createWorkShareImage(
  library: Library,
  workId: string,
  variant: WorkShareVariant,
  coverDataUrl: string | null = null,
  coverOptions: ShareCoverOptions = DEFAULT_SHARE_COVER_OPTIONS,
): Promise<ShareImageFile> {
  const payload = await buildWorkSharePayload(
    library,
    workId,
    variant,
    coverDataUrl,
    coverOptions,
  );
  const mosaicSuffix =
    payload.coverDataUrl && coverOptions.coverMosaic
      ? `-mosaic-${Math.max(1, Math.min(5, Math.round(coverOptions.mosaicLevel)))}`
      : "";

  return {
    id: `${payload.workId}-${payload.variant}${mosaicSuffix}-${Date.now()}`,
    extension: "svg",
    bytes: new TextEncoder().encode(renderWorkShareSvg(payload)),
  };
}

export function buildRankingSharePayload(
  library: Library,
  rankingId: string,
  orderedWorks: Work[],
): RankingSharePayload {
  const ranking = library.rankings.find((item) => item.id === rankingId);

  if (!ranking) {
    throw new Error("Ranking not found.");
  }

  const category = library.categories.find(
    (item) => item.id === ranking.categoryId,
  );

  if (!category) {
    throw new Error("Ranking category not found.");
  }

  if (orderedWorks.length === 0) {
    throw new Error("Ranking has no works.");
  }

  if (
    orderedWorks.some(
      (work) =>
        !isCategoryInScope(library, ranking.categoryId, work.categoryId),
    )
  ) {
    throw new Error("Ranking export includes works from another category.");
  }

  return buildRankingSharePayloadFromSource({
    rankingId: ranking.id,
    rankingName: ranking.name,
    categoryName: category.name,
    mode: ranking.mode,
    dimensionId: ranking.dimensionId,
    dimensionName: ranking.dimensionId
      ? getRankingDimensionName(ranking.dimensionId, orderedWorks)
      : null,
    orderedWorks,
  });
}

export function buildRankingPreviewSharePayload(
  input: RankingPreviewShareInput,
): RankingSharePayload {
  if (input.orderedWorks.length === 0) {
    throw new Error("Ranking has no works.");
  }

  return buildRankingSharePayloadFromSource({
    rankingId: `preview-${Date.now()}`,
    rankingName: input.rankingName,
    categoryName: input.categoryName,
    mode: input.mode,
    dimensionId: input.dimensionId,
    dimensionName: input.dimensionName,
    orderedWorks: input.orderedWorks,
  });
}

export function createRankingShareImage(
  library: Library,
  rankingId: string,
  orderedWorks: Work[],
): ShareImageFile {
  const payload = buildRankingSharePayload(library, rankingId, orderedWorks);

  return {
    id: `${payload.rankingId}-${payload.variant}-${Date.now()}`,
    extension: "svg",
    bytes: new TextEncoder().encode(renderRankingShareSvg(payload)),
  };
}

export function createRankingPreviewShareImage(
  input: RankingPreviewShareInput,
): ShareImageFile {
  const payload = buildRankingPreviewSharePayload(input);

  return {
    id: `${sanitizeFileStem(payload.rankingId)}-${payload.variant}-${Date.now()}`,
    extension: "svg",
    bytes: new TextEncoder().encode(renderRankingShareSvg(payload)),
  };
}

export async function buildTierListSharePayload(
  library: Library,
  tierListId: string,
  coverImages: Map<string, string> = new Map(),
  coverOptions: ShareCoverOptions = DEFAULT_SHARE_COVER_OPTIONS,
): TierListSharePayload {
  const tierList = library.tierLists.find((item) => item.id === tierListId);

  if (!tierList) {
    throw new Error("Tier list not found.");
  }

  const category = library.categories.find(
    (item) => item.id === tierList.categoryId,
  );

  if (!category) {
    throw new Error("Tier list category not found.");
  }

  const levels = await Promise.all(
    tierList.levels.map(async (level) => ({
      id: level.id,
      name: level.name,
      items: await Promise.all(
        level.workIds.map(async (workId) => {
          const work = library.works.find((item) => item.id === workId);

          if (
            !work ||
            !isCategoryInScope(library, tierList.categoryId, work.categoryId)
          ) {
            return null;
          }

          const coverDataUrl = work.coverImagePath
            ? (coverImages.get(work.id) ?? null)
            : null;
          const displayCoverDataUrl =
            coverDataUrl && coverOptions.coverMosaic
              ? await createMosaicImageDataUrl(
                  coverDataUrl,
                  coverOptions.mosaicLevel,
                )
              : coverDataUrl;

          return {
            title: work.title,
            coverImagePath: work.coverImagePath,
            coverDataUrl: displayCoverDataUrl,
          };
        }),
      ).then((items) => items.flatMap((item) => (item ? [item] : []))),
    })),
  );

  if (levels.every((level) => level.items.length === 0)) {
    throw new Error("Tier list has no assigned works.");
  }

  return {
    variant: "tier",
    tierListId: tierList.id,
    tierListName: tierList.name,
    categoryName: category.name,
    levels,
  };
}

export async function buildTierListPreviewSharePayload(
  input: TierListPreviewShareInput,
  coverOptions: ShareCoverOptions = DEFAULT_SHARE_COVER_OPTIONS,
): TierListSharePayload {
  const coverImages = input.coverImages ?? new Map<string, string>();
  const workById = new Map(input.works.map((work) => [work.id, work] as const));
  const levels = await Promise.all(
    input.levels.map(async (level) => ({
      id: level.id,
      name: normalizeTierLevelName(level),
      items: await Promise.all(
        level.workIds.map(async (workId) => {
          const work = workById.get(workId);

          if (!work) {
            return null;
          }

          const coverDataUrl = work.coverImagePath
            ? (coverImages.get(work.id) ?? null)
            : null;
          const displayCoverDataUrl =
            coverDataUrl && coverOptions.coverMosaic
              ? await createMosaicImageDataUrl(
                  coverDataUrl,
                  coverOptions.mosaicLevel,
                )
              : coverDataUrl;

          return {
            title: work.title,
            coverImagePath: work.coverImagePath,
            coverDataUrl: displayCoverDataUrl,
          };
        }),
      ).then((items) => items.flatMap((item) => (item ? [item] : []))),
    })),
  );

  if (levels.every((level) => level.items.length === 0)) {
    throw new Error("Tier list has no assigned works.");
  }

  return {
    variant: "tier",
    tierListId: input.tierListId,
    tierListName: input.tierListName.trim() || "五级分级",
    categoryName: input.categoryName,
    levels,
  };
}

function isCategoryInScope(
  library: Library,
  scopeCategoryId: string,
  categoryId: string,
): boolean {
  return (
    scopeCategoryId === categoryId ||
    getCategoryAncestorIds(library, categoryId).includes(scopeCategoryId)
  );
}

export async function createTierListShareImage(
  library: Library,
  tierListId: string,
  coverImages: Map<string, string> = new Map(),
  coverOptions: ShareCoverOptions = DEFAULT_SHARE_COVER_OPTIONS,
): Promise<ShareImageFile> {
  const payload = await buildTierListSharePayload(
    library,
    tierListId,
    coverImages,
    coverOptions,
  );
  const mosaicSuffix = payload.levels.some((level) =>
    level.items.some((item) => item.coverDataUrl !== null),
  )
    ? coverOptions.coverMosaic
      ? `-mosaic-${Math.max(1, Math.min(5, Math.round(coverOptions.mosaicLevel)))}`
      : ""
    : "";

  return {
    id: `${payload.tierListId}-${payload.variant}${mosaicSuffix}-${Date.now()}`,
    extension: "svg",
    bytes: new TextEncoder().encode(renderTierListShareSvg(payload)),
  };
}

export async function createTierListPreviewShareImage(
  input: TierListPreviewShareInput,
  coverOptions: ShareCoverOptions = DEFAULT_SHARE_COVER_OPTIONS,
): Promise<ShareImageFile> {
  const payload = await buildTierListPreviewSharePayload(input, coverOptions);
  const mosaicSuffix = payload.levels.some((level) =>
    level.items.some((item) => item.coverDataUrl !== null),
  )
    ? coverOptions.coverMosaic
      ? `-mosaic-${Math.max(1, Math.min(5, Math.round(coverOptions.mosaicLevel)))}`
      : ""
    : "";

  return {
    id: `${sanitizeFileStem(payload.tierListId)}-${payload.variant}${mosaicSuffix}-${Date.now()}`,
    extension: "svg",
    bytes: new TextEncoder().encode(renderTierListShareSvg(payload)),
  };
}

export function renderWorkShareSvg(payload: WorkSharePayload): string {
  const dimensions = payload.ratingDimensions.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
    score: dimension.score,
    weight: dimension.weight,
  }));
  const reviewSource =
    payload.variant === "long"
      ? (payload.longReview ?? payload.shortReview)
      : payload.shortReview;
  const reviewLines =
    reviewSource && reviewSource.trim()
      ? wrapParagraphs(reviewSource, payload.variant === "long" ? 27 : 24)
      : ["还没有写下评价。"];
  const visibleReviewLines =
    payload.variant === "cover" ? reviewLines.slice(0, 4) : reviewLines;
  const dimensionRows = Math.max(1, Math.ceil(dimensions.length / 2));
  const dimensionBlockHeight = dimensionRows * 146;
  const reviewBlockHeight = Math.max(168, visibleReviewLines.length * 38 + 94);
  const cardHeight = 438 + dimensionBlockHeight + 36 + reviewBlockHeight + 74;
  const height = Math.max(
    payload.variant === "cover" ? 1180 : 1320,
    cardHeight + 72,
  );
  const scoreLabel = formatShareScore(payload.finalScore);
  const coverLabel = payload.coverImagePath
    ? `封面已入库: ${payload.coverImagePath}`
    : "未设置封面";
  const recommendation = getRecommendationLabel(payload.finalScore);
  const titleLines = wrapText(payload.title, 11).slice(0, 2);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.title,
    )}">`,
    `<defs><clipPath id="work-card-cover-clip"><rect x="72" y="82" width="344" height="252" rx="24"/></clipPath></defs>`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#fff7ed"/>`,
    `<rect x="28" y="28" width="1024" height="${height - 72}" rx="42" fill="#ffffff"/>`,
    `<rect x="72" y="82" width="344" height="252" rx="24" fill="#f3d6dc"/>`,
  ];

  if (payload.coverDataUrl) {
    parts.push(
      `<image href="${escapeXml(payload.coverDataUrl)}" x="72" y="82" width="344" height="252" preserveAspectRatio="xMidYMid slice" clip-path="url(#work-card-cover-clip)"/>`,
    );
  } else {
    parts.push(
      `<text x="244" y="214" fill="#9f5262" font-family="system-ui, sans-serif" font-size="28" font-weight="900" text-anchor="middle">${escapeXml(
        coverLabel,
      )}</text>`,
    );
  }

  parts.push(
    `<rect x="448" y="84" width="126" height="46" rx="23" fill="#ff4f73"/>`,
    `<text x="511" y="114" fill="#ffffff" font-family="system-ui, sans-serif" font-size="22" font-weight="900" text-anchor="middle">作品赏析</text>`,
    `<text x="934" y="114" fill="#ff4f73" font-family="system-ui, sans-serif" font-size="20" font-weight="900" text-anchor="end">${escapeXml(
      payload.categoryName,
    )}</text>`,
  );

  titleLines.forEach((line, index) => {
    parts.push(
      `<text x="710" y="${188 + index * 54}" fill="#3f3f46" font-family="system-ui, sans-serif" font-size="44" font-weight="900" text-anchor="middle">${escapeXml(
        line,
      )}</text>`,
    );
  });

  parts.push(
    `<text x="448" y="306" fill="#3f3f46" font-family="system-ui, sans-serif" font-size="82" font-weight="900">${escapeXml(
      scoreLabel,
    )}</text>`,
    `<text x="690" y="264" fill="#ff4f73" font-family="system-ui, sans-serif" font-size="32" font-weight="900">${escapeXml(
      recommendation,
    )}</text>`,
    renderStarRow(payload.finalScore, 686, 312, 32, 12),
    `<text x="448" y="368" fill="#6b7280" font-family="system-ui, sans-serif" font-size="22" font-weight="700">${escapeXml(
      `整体完成度很高，适合加入 ${payload.categoryName} 推荐名单。`,
    )}</text>`,
  );

  let cursor = 426;

  if (dimensions.length > 0) {
    dimensions.forEach((dimension, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 72 + column * 488;
      const y = cursor + row * 146;

      parts.push(
        `<rect x="${x}" y="${y}" width="456" height="124" rx="24" fill="#fff0f2"/>`,
        `<text x="${x + 24}" y="${y + 42}" fill="#3f3f46" font-family="system-ui, sans-serif" font-size="24" font-weight="900">${escapeXml(
          dimension.name,
        )}</text>`,
        `<text x="${x + 414}" y="${y + 48}" fill="#3f3f46" font-family="system-ui, sans-serif" font-size="42" font-weight="900" text-anchor="end">${escapeXml(
          formatShareScore(dimension.score),
        )}</text>`,
        renderStarRow(dimension.score, x + 24, y + 92, 30, 8),
      );
    });
  } else {
    parts.push(
      `<rect x="72" y="${cursor}" width="936" height="124" rx="24" fill="#fff0f2"/>`,
      `<text x="540" y="${cursor + 76}" fill="#9ca3af" font-family="system-ui, sans-serif" font-size="26" font-weight="900" text-anchor="middle">暂无评分维度</text>`,
    );
  }

  cursor += dimensionBlockHeight + 34;

  parts.push(
    `<rect x="72" y="${cursor}" width="936" height="${reviewBlockHeight}" rx="24" fill="#fafafa"/>`,
    `<text x="540" y="${cursor + 50}" fill="#b8b8c2" font-family="system-ui, sans-serif" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="10">REVIEW</text>`,
  );

  visibleReviewLines.forEach((line, index) => {
    parts.push(
      `<text x="540" y="${cursor + 100 + index * 38}" fill="#3f3f46" font-family="system-ui, sans-serif" font-size="24" font-weight="700" text-anchor="middle">${escapeXml(
        line,
      )}</text>`,
    );
  });

  parts.push(
    `<text x="540" y="${height - 54}" fill="#d1a1a9" font-family="system-ui, sans-serif" font-size="18" font-weight="900" text-anchor="middle">Taste Ledger</text>`,
    "</svg>",
  );

  return parts.join("");
}

function buildRankingSharePayloadFromSource(source: {
  rankingId: string;
  rankingName: string;
  categoryName: string;
  mode: RankingMode;
  dimensionId: string | null;
  dimensionName: string | null;
  orderedWorks: Work[];
}): RankingSharePayload {
  const sortLabel =
    source.mode === "manual"
      ? "手动排序"
      : source.mode === "dimension" && source.dimensionName
        ? `按${source.dimensionName}`
        : "按最终评分";

  return {
    variant: "long",
    rankingId: source.rankingId,
    rankingName: source.rankingName,
    categoryName: source.categoryName,
    sortLabel,
    items: source.orderedWorks.map((work, index) => ({
      rank: index + 1,
      title: work.title,
      scoreLabel: getRankingScoreLabel(source.mode, source.dimensionId, work),
    })),
  };
}

export function renderRankingShareSvg(payload: RankingSharePayload): string {
  const renderedItems = payload.items.map((item) => ({
    ...item,
    titleLines: createRankingTitleLines(item.title),
  }));
  const rowHeights = renderedItems.map((item) =>
    item.titleLines.length > 1 ? 112 : 88,
  );
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const height = Math.max(860, 306 + rowsHeight + 116);
  let cursor = 112;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.rankingName,
    )}">`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#fff7ed"/>`,
    `<rect x="32" y="32" width="1016" height="${height - 64}" rx="36" fill="#ffffff"/>`,
    `<rect x="72" y="78" width="156" height="44" rx="22" fill="#ff4f73"/>`,
    `<text x="150" y="107" fill="#ffffff" font-family="system-ui, sans-serif" font-size="22" font-weight="900" text-anchor="middle">分值排名</text>`,
    `<text x="1008" y="108" fill="#ff4f73" font-family="system-ui, sans-serif" font-size="22" font-weight="900" text-anchor="end">${escapeXml(
      payload.categoryName,
    )}</text>`,
  ];

  cursor += 66;
  parts.push(
    `<text x="72" y="${cursor}" fill="#3f3f46" font-family="system-ui, sans-serif" font-size="54" font-weight="900">${escapeXml(
      payload.rankingName,
    )}</text>`,
  );

  cursor += 48;
  parts.push(
    `<text x="72" y="${cursor}" fill="#6b7280" font-family="system-ui, sans-serif" font-size="24" font-weight="800">${escapeXml(
      payload.sortLabel,
    )} · ${payload.items.length} 作品</text>`,
    `<line x1="72" y1="${cursor + 38}" x2="1008" y2="${cursor + 38}" stroke="#f3e3e5" stroke-width="2"/>`,
  );

  cursor += 92;
  parts.push(
    `<text x="96" y="${cursor}" fill="#b8b8c2" font-family="system-ui, sans-serif" font-size="18" font-weight="900">排名</text>`,
    `<text x="214" y="${cursor}" fill="#b8b8c2" font-family="system-ui, sans-serif" font-size="18" font-weight="900">作品</text>`,
    `<text x="916" y="${cursor}" fill="#b8b8c2" font-family="system-ui, sans-serif" font-size="18" font-weight="900" text-anchor="middle">分数</text>`,
  );

  cursor += 30;

  renderedItems.forEach((item, index) => {
    const rowHeight = rowHeights[index];
    const rowTop = cursor;
    const fill = index % 2 === 0 ? "#fff0f2" : "#fafafa";
    const rankFill = index < 3 ? "#ff4f73" : "#3f3f46";

    parts.push(
      `<rect x="72" y="${rowTop}" width="936" height="${rowHeight - 12}" rx="22" fill="${fill}"/>`,
      `<rect x="96" y="${rowTop + 18}" width="76" height="52" rx="16" fill="${rankFill}"/>`,
      `<text x="134" y="${rowTop + 53}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="25" font-weight="900" text-anchor="middle">#${String(
        item.rank,
      ).padStart(2, "0")}</text>`,
      `<rect x="836" y="${rowTop + 18}" width="160" height="52" rx="16" fill="#ffffff"/>`,
      `<text x="916" y="${rowTop + 53}" fill="#3f3f46" font-family="system-ui, sans-serif" font-size="24" font-weight="900" text-anchor="middle">${escapeXml(
        item.scoreLabel,
      )}</text>`,
    );

    item.titleLines.forEach((line, lineIndex) => {
      parts.push(
        `<text x="214" y="${rowTop + 48 + lineIndex * 34}" fill="#3f3f46" font-family="system-ui, sans-serif" font-size="30" font-weight="900">${escapeXml(
          line,
        )}</text>`,
      );
    });

    cursor += rowHeight;
  });

  parts.push(
    `<text x="540" y="${height - 54}" fill="#d1a1a9" font-family="system-ui, sans-serif" font-size="18" font-weight="900" text-anchor="middle">Taste Ledger</text>`,
    "</svg>",
  );

  return parts.join("");
}

export function renderTierListShareSvg(payload: TierListSharePayload): string {
  const renderedLevels = payload.levels.map((level) => ({
    ...level,
    rowCount: Math.max(1, Math.ceil(level.items.length / 6)),
  }));
  const cardWidth = 108;
  const cardHeight = 144;
  const gapX = 12;
  const gapY = 12;
  const levelHeights = renderedLevels.map((level) =>
    Math.max(
      196,
      82 + level.rowCount * cardHeight + Math.max(0, level.rowCount - 1) * gapY,
    ),
  );
  const rowsHeight =
    levelHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, renderedLevels.length - 1) * 8;
  const height = Math.max(1180, 224 + rowsHeight + 96);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.tierListName,
    )}">`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#f8fafc"/>`,
    `<rect x="48" y="48" width="984" height="${height - 96}" rx="28" fill="#0f172a"/>`,
    `<text x="88" y="116" fill="#ffffff" font-family="system-ui, sans-serif" font-size="46" font-weight="900">荣誉殿堂</text>`,
    `<text x="88" y="154" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="24" font-weight="800">${escapeXml(
      payload.tierListName,
    )} · ${escapeXml(payload.categoryName)}</text>`,
    `<rect x="848" y="92" width="136" height="44" rx="8" fill="#ffffff"/>`,
    `<text x="916" y="122" fill="#0f172a" font-family="system-ui, sans-serif" font-size="22" font-weight="900" text-anchor="middle">${escapeXml(
      `${payload.levels.length} 级`,
    )}</text>`,
    `<text x="984" y="164" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="800" text-anchor="end">Taste Ledger</text>`,
  ];

  let cursor = 200;

  renderedLevels.forEach((level, index) => {
    const rowHeight = levelHeights[index];
    const rowTop = cursor;
    const labelFill = getTierLabelColor(level.id);
    const labelTextFill = getTierLabelTextColor(level.id);
    const columns = 6;
    const startX = 236;
    const startY = rowTop + 26;

    parts.push(
      `<rect x="88" y="${rowTop}" width="904" height="${rowHeight}" rx="10" fill="#111827"/>`,
      `<rect x="92" y="${rowTop + 4}" width="120" height="${rowHeight - 8}" rx="6" fill="${labelFill}"/>`,
      `<text x="152" y="${rowTop + rowHeight / 2 + 10}" fill="${labelTextFill}" font-family="system-ui, sans-serif" font-size="34" font-weight="900" font-style="italic" text-anchor="middle">${escapeXml(
        level.name,
      )}</text>`,
      `<rect x="212" y="${rowTop + 4}" width="776" height="${rowHeight - 8}" rx="6" fill="#ffffff"/>`,
    );

    level.items.forEach((item, itemIndex) => {
      const column = itemIndex % columns;
      const row = Math.floor(itemIndex / columns);
      const x = startX + column * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);

      parts.push(
        `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="7" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>`,
        `<rect x="${x + 6}" y="${y + 6}" width="${cardWidth - 12}" height="${cardHeight - 12}" rx="5" fill="#e2e8f0"/>`,
      );

      if (item.coverDataUrl) {
        parts.push(
          `<image href="${escapeXml(item.coverDataUrl)}" x="${x + 6}" y="${y + 6}" width="${cardWidth - 12}" height="${cardHeight - 12}" preserveAspectRatio="xMidYMid slice"/>`,
        );
      } else {
        parts.push(
          `<text x="${x + cardWidth / 2}" y="${y + 78}" fill="#64748b" font-family="system-ui, sans-serif" font-size="16" font-weight="700" text-anchor="middle">${escapeXml(
            item.coverImagePath ? "封面未读取" : "未设置封面",
          )}</text>`,
        );
      }
    });

    if (level.items.length === 0) {
      parts.push(
        `<text x="${startX}" y="${rowTop + rowHeight / 2 + 8}" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="22" font-weight="800">暂无作品</text>`,
      );
    }

    cursor += rowHeight + 8;
  });

  parts.push("</svg>");

  return parts.join("");
}

function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatShareScore(score: number | null): string {
  if (score === null) {
    return "未评分";
  }

  return score.toFixed(1);
}

function getRecommendationLabel(score: number | null): string {
  const normalizedScore = normalizeFiveStarScore(score);

  if (normalizedScore >= 4.8) {
    return "神推";
  }

  if (normalizedScore >= 4.5) {
    return "强推";
  }

  if (normalizedScore >= 4) {
    return "推荐";
  }

  if (normalizedScore > 0) {
    return "记录";
  }

  return "待评分";
}

function renderStarRow(
  score: number | null,
  x: number,
  y: number,
  size: number,
  gap: number,
): string {
  const filledStars = Math.max(
    0,
    Math.min(5, Math.round(normalizeFiveStarScore(score))),
  );

  return Array.from({ length: 5 }, (_, index) => {
    const fill = index < filledStars ? "#ff4f73" : "#d6dce2";

    return `<text x="${x + index * (size + gap)}" y="${y}" fill="${fill}" font-family="system-ui, sans-serif" font-size="${size}" font-weight="900">★</text>`;
  }).join("");
}

function normalizeFiveStarScore(score: number | null): number {
  if (score === null || !Number.isFinite(score)) {
    return 0;
  }

  return score > 5 ? score / 2 : score;
}

function wrapParagraphs(value: string, maxLength: number): string[] {
  return value
    .split(/\r?\n/)
    .flatMap((line) => (line.trim() ? wrapText(line.trim(), maxLength) : [""]));
}

function wrapText(value: string, maxLength: number): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }

  return chunks;
}

function createRankingTitleLines(value: string): string[] {
  const lines = wrapText(value, 20);

  if (lines.length <= 2) {
    return lines;
  }

  return [lines[0], `${lines[1].slice(0, 17)}...`];
}

function normalizeTierLevelName(level: TierLevel): string {
  return level.name.trim() || getDefaultTierLevelName(level.id);
}

function getDefaultTierLevelName(levelId: TierLevelId): string {
  return (
    DEFAULT_TIER_LEVELS.find((definition) => definition.id === levelId)?.name ??
    levelId
  );
}

function getTierLabelColor(levelId: TierLevelId): string {
  switch (levelId) {
    case "tier-1":
      return "#ff7f7f";
    case "tier-2":
      return "#ffbf7f";
    case "tier-3":
      return "#ffff7f";
    case "tier-4":
      return "#7fff7f";
    case "tier-5":
      return "#7fbfff";
  }
}

function getTierLabelTextColor(levelId: TierLevelId): string {
  switch (levelId) {
    case "tier-1":
      return "#7f0000";
    case "tier-2":
      return "#7f3f00";
    case "tier-3":
      return "#7f7f00";
    case "tier-4":
      return "#007f00";
    case "tier-5":
      return "#003f7f";
  }
}

function getRankingDimensionName(dimensionId: string, works: Work[]): string {
  for (const work of works) {
    const dimension = work.ratingDimensions.find(
      (item) => item.id === dimensionId,
    );

    if (dimension) {
      return dimension.name;
    }
  }

  return `维度 ${dimensionId}`;
}

function getRankingScoreLabel(
  mode: RankingMode,
  dimensionId: string | null,
  work: Work,
): string {
  if (mode === "dimension" && dimensionId) {
    const dimension = work.ratingDimensions.find(
      (item) => item.id === dimensionId,
    );
    return dimension ? `${dimension.score} 分` : "未评分";
  }

  return work.finalScore === null ? "未评分" : `${work.finalScore} 分`;
}

function sanitizeFileStem(value: string): string {
  const normalized = Array.from(value.normalize("NFKC"), (character) =>
    character.charCodeAt(0) < 32 ? "_" : character,
  ).join("");
  const sanitized = normalized
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return sanitized.length > 0 ? sanitized : "taste-ledger-export";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
