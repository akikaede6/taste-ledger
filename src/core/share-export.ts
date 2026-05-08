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

export type WorkShareVariant = "cover" | "long";
export type RankingShareVariant = "long";

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
const TEXT_LEFT = 112;

export function buildWorkSharePayload(
  library: Library,
  workId: string,
  variant: WorkShareVariant,
  coverDataUrl: string | null = null,
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

  return {
    variant,
    workId: work.id,
    title: work.title,
    categoryName: category.name,
    coverImagePath: work.coverImagePath,
    coverDataUrl,
    finalScore: work.finalScore,
    ratingDimensions: work.ratingDimensions,
    shortReview: trimToNull(work.shortReview),
    longReview: variant === "long" ? trimToNull(work.longReview) : null,
  };
}

export function createWorkShareImage(
  library: Library,
  workId: string,
  variant: WorkShareVariant,
  coverDataUrl: string | null = null,
): ShareImageFile {
  const payload = buildWorkSharePayload(library, workId, variant, coverDataUrl);

  return {
    id: `${payload.workId}-${payload.variant}-${Date.now()}`,
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

export function buildTierListSharePayload(
  library: Library,
  tierListId: string,
  coverImages: Map<string, string> = new Map(),
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

  const levels = tierList.levels.map((level) => ({
    id: level.id,
    name: level.name,
    items: level.workIds.flatMap((workId) => {
      const work = library.works.find((item) => item.id === workId);

      if (
        !work ||
        !isCategoryInScope(library, tierList.categoryId, work.categoryId)
      ) {
        return [];
      }

      return [
        {
          title: work.title,
          coverImagePath: work.coverImagePath,
          coverDataUrl: work.coverImagePath
            ? (coverImages.get(work.id) ?? null)
            : null,
        },
      ];
    }),
  }));

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

export function buildTierListPreviewSharePayload(
  input: TierListPreviewShareInput,
): TierListSharePayload {
  const coverImages = input.coverImages ?? new Map<string, string>();
  const workById = new Map(input.works.map((work) => [work.id, work] as const));
  const levels = input.levels.map((level) => ({
    id: level.id,
    name: normalizeTierLevelName(level),
    items: level.workIds.flatMap((workId) => {
      const work = workById.get(workId);

      if (!work) {
        return [];
      }

      return [
        {
          title: work.title,
          coverImagePath: work.coverImagePath,
          coverDataUrl: work.coverImagePath
            ? (coverImages.get(work.id) ?? null)
            : null,
        },
      ];
    }),
  }));

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

export function createTierListShareImage(
  library: Library,
  tierListId: string,
  coverImages: Map<string, string> = new Map(),
): ShareImageFile {
  const payload = buildTierListSharePayload(library, tierListId, coverImages);

  return {
    id: `${payload.tierListId}-${payload.variant}-${Date.now()}`,
    extension: "svg",
    bytes: new TextEncoder().encode(renderTierListShareSvg(payload)),
  };
}

export function createTierListPreviewShareImage(
  input: TierListPreviewShareInput,
): ShareImageFile {
  const payload = buildTierListPreviewSharePayload(input);

  return {
    id: `${sanitizeFileStem(payload.tierListId)}-${payload.variant}-${Date.now()}`,
    extension: "svg",
    bytes: new TextEncoder().encode(renderTierListShareSvg(payload)),
  };
}

export function renderWorkShareSvg(payload: WorkSharePayload): string {
  if (payload.variant === "cover") {
    const reviewLines = payload.shortReview
      ? wrapText(payload.shortReview, 16).slice(0, 3)
      : ["尚未填写短评"];
    const scoreLabel =
      payload.finalScore === null ? "未评分" : `${payload.finalScore}`;
    const coverLabel = payload.coverImagePath
      ? `封面已入库: ${payload.coverImagePath}`
      : "未设置封面";
    const parts: string[] = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="1440" viewBox="0 0 ${IMAGE_WIDTH} 1440" role="img" aria-label="${escapeXml(
        payload.title,
      )}">`,
      `<defs>
        <linearGradient id="work-cover-shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0"/>
          <stop offset="46%" stop-color="#0f172a" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.92"/>
        </linearGradient>
      </defs>`,
      `<rect width="${IMAGE_WIDTH}" height="1440" fill="#0f172a"/>`,
    ];

    if (payload.coverDataUrl) {
      parts.push(
        `<image href="${escapeXml(payload.coverDataUrl)}" x="0" y="0" width="${IMAGE_WIDTH}" height="1440" preserveAspectRatio="xMidYMid slice"/>`,
      );
    } else {
      parts.push(
        `<rect width="${IMAGE_WIDTH}" height="1440" fill="#e2e8f0"/>`,
        `<text x="540" y="680" fill="#475569" font-family="system-ui, sans-serif" font-size="38" font-weight="800" text-anchor="middle">${escapeXml(
          coverLabel,
        )}</text>`,
      );
    }

    parts.push(
      `<rect width="${IMAGE_WIDTH}" height="1440" fill="url(#work-cover-shade)"/>`,
      `<rect x="72" y="72" width="184" height="48" rx="24" fill="#ffffff" opacity="0.92"/>`,
      `<text x="164" y="104" fill="#0f172a" font-family="system-ui, sans-serif" font-size="24" font-weight="900" text-anchor="middle">Taste Ledger</text>`,
      `<rect x="276" y="72" width="172" height="48" rx="24" fill="#ffffff" opacity="0.18"/>`,
      `<text x="362" y="104" fill="#ffffff" font-family="system-ui, sans-serif" font-size="24" font-weight="800" text-anchor="middle">${escapeXml(
        payload.categoryName,
      )}</text>`,
      `<rect x="72" y="1068" width="132" height="44" rx="8" fill="#dc2626"/>`,
      `<text x="138" y="1098" fill="#ffffff" font-family="system-ui, sans-serif" font-size="24" font-weight="900" text-anchor="middle">SCORE</text>`,
      `<rect x="220" y="1068" width="124" height="44" rx="8" fill="#ffffff" opacity="0.18"/>`,
      `<text x="282" y="1098" fill="#ffffff" font-family="system-ui, sans-serif" font-size="28" font-weight="900" text-anchor="middle">${escapeXml(
        scoreLabel,
      )}</text>`,
    );

    reviewLines.forEach((line, index) => {
      parts.push(
        `<text x="72" y="${1182 + index * 64}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="52" font-weight="900">${escapeXml(
          line,
        )}</text>`,
      );
    });

    parts.push(
      `<line x1="72" y1="1370" x2="1008" y2="1370" stroke="#ffffff" stroke-opacity="0.24" stroke-width="2"/>`,
      `<text x="72" y="1408" fill="#ffffff" fill-opacity="0.84" font-family="system-ui, sans-serif" font-size="22" font-weight="800">Taste Ledger Review</text>`,
      `<text x="1008" y="1408" fill="#ffffff" fill-opacity="0.84" font-family="system-ui, sans-serif" font-size="22" font-weight="800" text-anchor="end">${escapeXml(
        payload.categoryName,
      )}</text>`,
      `</svg>`,
    );

    return parts.join("");
  }

  const longReviewLines =
    payload.longReview && payload.longReview.trim()
      ? wrapParagraphs(payload.longReview, 31)
      : [];
  const scoreLabel =
    payload.finalScore === null ? "未评分" : `${payload.finalScore} 分`;
  const coverLabel = payload.coverImagePath
    ? `封面已入库: ${payload.coverImagePath}`
    : "未设置封面";
  const dimensions = payload.ratingDimensions.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
    score: dimension.score,
    weight: dimension.weight,
  }));
  const dimensionHeight =
    dimensions.length > 0 ? 92 + dimensions.length * 74 : 0;
  const reviewHeight =
    longReviewLines.length > 0 ? 124 + longReviewLines.length * 34 : 0;
  const coverHeight = 480;
  const height = Math.max(1420, 864 + dimensionHeight + reviewHeight);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.title,
    )}">`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#f4f7fb"/>`,
    `<rect x="52" y="52" width="976" height="${height - 104}" rx="22" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>`,
    `<text x="540" y="112" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="900" text-anchor="middle">TASTE LEDGER RECOMMENDATION</text>`,
    `<text x="540" y="166" fill="#0f172a" font-family="system-ui, sans-serif" font-size="46" font-weight="900" text-anchor="middle">作品深度解析报告</text>`,
  ];

  let cursor = 220;
  parts.push(
    `<rect x="${TEXT_LEFT}" y="${cursor}" width="856" height="${coverHeight}" rx="14" fill="#e2e8f0"/>`,
  );

  if (payload.coverDataUrl) {
    parts.push(
      `<image href="${escapeXml(payload.coverDataUrl)}" x="${TEXT_LEFT}" y="${cursor}" width="856" height="${coverHeight}" preserveAspectRatio="xMidYMid slice"/>`,
    );
  } else {
    parts.push(
      `<text x="540" y="${cursor + 248}" fill="#475569" font-family="system-ui, sans-serif" font-size="30" font-weight="800" text-anchor="middle">${escapeXml(
        coverLabel,
      )}</text>`,
    );
  }

  cursor += 528;
  parts.push(
    `<rect x="${TEXT_LEFT}" y="${cursor}" width="268" height="74" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`,
    `<text x="${TEXT_LEFT + 22}" y="${cursor + 28}" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="900">综合评分</text>`,
    `<text x="${TEXT_LEFT + 22}" y="${cursor + 58}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="30" font-weight="900">${escapeXml(
      scoreLabel,
    )}</text>`,
    `<rect x="406" y="${cursor}" width="268" height="74" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`,
    `<text x="428" y="${cursor + 28}" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="900">分类</text>`,
    `<text x="428" y="${cursor + 58}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="28" font-weight="900">${escapeXml(
      payload.categoryName,
    )}</text>`,
    `<rect x="700" y="${cursor}" width="268" height="74" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`,
    `<text x="722" y="${cursor + 28}" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="900">评分维度</text>`,
    `<text x="722" y="${cursor + 58}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="30" font-weight="900">${escapeXml(
      `${dimensions.length}`,
    )}</text>`,
  );

  cursor += 122;

  if (dimensions.length > 0) {
    parts.push(
      `<text x="${TEXT_LEFT}" y="${cursor}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="30" font-weight="900">维度评分</text>`,
    );
    cursor += 36;

    dimensions.forEach((dimension, index) => {
      const y = cursor + index * 74;
      const scoreWidth = Math.max(
        0,
        Math.min(100, Math.round(dimension.score * 10)),
      );

      parts.push(
        `<text x="${TEXT_LEFT}" y="${y + 18}" fill="#475569" font-family="system-ui, sans-serif" font-size="22" font-weight="800">${escapeXml(
          dimension.name,
        )}</text>`,
        `<text x="968" y="${y + 18}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="22" font-weight="900" text-anchor="end">${escapeXml(
          `${dimension.score} · 权重 ${dimension.weight}`,
        )}</text>`,
        `<rect x="${TEXT_LEFT}" y="${y + 38}" width="856" height="4" rx="2" fill="#e2e8f0"/>`,
        `<rect x="${TEXT_LEFT}" y="${y + 38}" width="${(856 * scoreWidth) / 100}" height="4" rx="2" fill="#0f172a"/>`,
      );
    });

    cursor += dimensions.length * 74 + 24;
  }

  if (longReviewLines.length > 0) {
    parts.push(
      `<text x="${TEXT_LEFT}" y="${cursor}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="30" font-weight="900">深度评测</text>`,
    );
    cursor += 36;

    parts.push(
      `<rect x="${TEXT_LEFT}" y="${cursor}" width="856" height="${longReviewLines.length * 34 + 44}" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`,
    );

    longReviewLines.forEach((line, index) => {
      parts.push(
        `<text x="${TEXT_LEFT + 24}" y="${cursor + 40 + index * 34}" fill="#334155" font-family="system-ui, sans-serif" font-size="24" font-weight="500">${escapeXml(
          line,
        )}</text>`,
      );
    });

    cursor += longReviewLines.length * 34 + 70;
  }

  parts.push(
    `<line x1="${TEXT_LEFT}" y1="${height - 110}" x2="968" y2="${height - 110}" stroke="#e2e8f0" stroke-width="2"/>`,
    `<text x="540" y="${height - 70}" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="800" text-anchor="middle">Taste Ledger © Local Rating Archive</text>`,
  );

  parts.push("</svg>");

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
    item.titleLines.length > 1 ? 112 : 86,
  );
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const height = Math.max(820, 356 + rowsHeight + 120);
  let cursor = 112;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.rankingName,
    )}">`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#f4f7fb"/>`,
    `<rect x="40" y="40" width="1000" height="${height - 80}" rx="40" fill="#ffffff" stroke="#dbe3ef" stroke-width="2"/>`,
    `<rect x="${TEXT_LEFT}" y="${cursor - 28}" width="180" height="44" rx="22" fill="#eff6ff"/>`,
    `<text x="${TEXT_LEFT + 90}" y="${cursor}" fill="#1d4ed8" font-family="system-ui, sans-serif" font-size="26" font-weight="800" text-anchor="middle">${escapeXml(
      payload.categoryName,
    )}</text>`,
  ];

  cursor += 78;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="58" font-weight="900">${escapeXml(
      payload.rankingName,
    )}</text>`,
  );

  cursor += 52;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#64748b" font-family="system-ui, sans-serif" font-size="28" font-weight="700">${escapeXml(
      payload.sortLabel,
    )} · ${payload.items.length} 作品</text>`,
  );

  cursor += 74;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="32" font-weight="800">作品顺位</text>`,
  );

  cursor += 42;

  renderedItems.forEach((item, index) => {
    const rowHeight = rowHeights[index];
    const rowTop = cursor - 28;
    const fill = index % 2 === 0 ? "#f8fafc" : "#ffffff";

    parts.push(
      `<rect x="88" y="${rowTop}" width="904" height="${rowHeight - 12}" rx="22" fill="${fill}" stroke="#e2e8f0" stroke-width="1"/>`,
      `<rect x="112" y="${cursor - 4}" width="72" height="72" rx="18" fill="#0f172a"/>`,
      `<text x="148" y="${cursor + 40}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="32" font-weight="900" text-anchor="middle">#${item.rank}</text>`,
    );

    item.titleLines.forEach((line, lineIndex) => {
      parts.push(
        `<text x="214" y="${cursor + 8 + lineIndex * 34}" fill="#0f172a" font-family="system-ui, sans-serif" font-size="30" font-weight="800">${escapeXml(
          line,
        )}</text>`,
      );
    });

    parts.push(
      `<text x="872" y="${cursor + 18}" fill="#334155" font-family="system-ui, sans-serif" font-size="28" font-weight="800" text-anchor="end">${escapeXml(
        item.scoreLabel,
      )}</text>`,
    );

    cursor += rowHeight;
  });

  parts.push("</svg>");

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
