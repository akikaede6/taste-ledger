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
  const shortReviewLines = payload.shortReview
    ? wrapText(payload.shortReview, 28)
    : [];
  const longReviewLines =
    payload.variant === "long" && payload.longReview
      ? wrapParagraphs(payload.longReview, 32)
      : [];
  const dimensionRows = payload.ratingDimensions.map(
    (dimension) =>
      `${dimension.name}: ${dimension.score} x ${dimension.weight}`,
  );
  const height =
    926 +
    shortReviewLines.length * 34 +
    dimensionRows.length * 38 +
    longReviewLines.length * 34;

  const scoreLabel =
    payload.finalScore === null ? "未评分" : `${payload.finalScore} 分`;
  const coverLabel = payload.coverImagePath
    ? `封面已入库: ${payload.coverImagePath}`
    : "未设置封面";

  let cursor = 112;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.title,
    )}">`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#f8fafc"/>`,
    `<rect x="48" y="48" width="984" height="${height - 96}" rx="36" fill="#ffffff" stroke="#dbe3ef" stroke-width="2"/>`,
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#64748b" font-family="system-ui, sans-serif" font-size="30" font-weight="700">${escapeXml(
      payload.categoryName,
    )}</text>`,
  ];

  cursor += 76;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#0f766e" font-family="system-ui, sans-serif" font-size="38" font-weight="800">${escapeXml(
      scoreLabel,
    )}</text>`,
  );

  cursor += 56;
  parts.push(
    `<rect x="${TEXT_LEFT}" y="${cursor}" width="856" height="360" rx="28" fill="#e2e8f0"/>`,
  );

  if (payload.coverDataUrl) {
    parts.push(
      `<image href="${escapeXml(payload.coverDataUrl)}" x="${TEXT_LEFT}" y="${cursor}" width="856" height="360" preserveAspectRatio="xMidYMid slice"/>`,
    );
  } else {
    parts.push(
      `<text x="${TEXT_LEFT + 36}" y="${cursor + 190}" fill="#475569" font-family="system-ui, sans-serif" font-size="30" font-weight="700">${escapeXml(
        coverLabel,
      )}</text>`,
    );
  }

  cursor += 430;

  if (dimensionRows.length > 0) {
    parts.push(
      `<text x="${TEXT_LEFT}" y="${cursor}" fill="#1f2937" font-family="system-ui, sans-serif" font-size="34" font-weight="800">评分维度</text>`,
    );
    cursor += 48;
    for (const row of dimensionRows) {
      parts.push(
        `<text x="${TEXT_LEFT}" y="${cursor}" fill="#334155" font-family="system-ui, sans-serif" font-size="28">${escapeXml(
          row,
        )}</text>`,
      );
      cursor += 38;
    }
  }

  if (shortReviewLines.length > 0) {
    cursor += 28;
    parts.push(
      `<text x="${TEXT_LEFT}" y="${cursor}" fill="#1f2937" font-family="system-ui, sans-serif" font-size="34" font-weight="800">短评</text>`,
    );
    cursor += 48;
    for (const line of shortReviewLines) {
      parts.push(
        `<text x="${TEXT_LEFT}" y="${cursor}" fill="#334155" font-family="system-ui, sans-serif" font-size="28">${escapeXml(
          line,
        )}</text>`,
      );
      cursor += 34;
    }
  }

  if (longReviewLines.length > 0) {
    cursor += 28;
    parts.push(
      `<text x="${TEXT_LEFT}" y="${cursor}" fill="#1f2937" font-family="system-ui, sans-serif" font-size="34" font-weight="800">长评</text>`,
    );
    cursor += 48;
    for (const line of longReviewLines) {
      parts.push(
        `<text x="${TEXT_LEFT}" y="${cursor}" fill="#334155" font-family="system-ui, sans-serif" font-size="28">${escapeXml(
          line,
        )}</text>`,
      );
      cursor += 34;
    }
  }

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
  const height = Math.max(760, 356 + rowsHeight + 112);
  let cursor = 112;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.rankingName,
    )}">`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#f8fafc"/>`,
    `<rect x="48" y="48" width="984" height="${height - 96}" rx="36" fill="#ffffff" stroke="#dbe3ef" stroke-width="2"/>`,
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#64748b" font-family="system-ui, sans-serif" font-size="30" font-weight="700">${escapeXml(
      payload.categoryName,
    )}</text>`,
  ];

  cursor += 76;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#111827" font-family="system-ui, sans-serif" font-size="58" font-weight="800">${escapeXml(
      payload.rankingName,
    )}</text>`,
  );

  cursor += 54;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#0f766e" font-family="system-ui, sans-serif" font-size="34" font-weight="800">${escapeXml(
      payload.sortLabel,
    )} · ${payload.items.length} 作品</text>`,
  );

  cursor += 78;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#1f2937" font-family="system-ui, sans-serif" font-size="32" font-weight="800">作品顺位</text>`,
  );

  cursor += 42;

  renderedItems.forEach((item, index) => {
    const rowHeight = rowHeights[index];
    const rowTop = cursor - 28;
    const fill = index % 2 === 0 ? "#f8fafc" : "#ffffff";

    parts.push(
      `<rect x="88" y="${rowTop}" width="904" height="${rowHeight - 12}" rx="22" fill="${fill}" stroke="#e2e8f0" stroke-width="1"/>`,
      `<text x="${TEXT_LEFT}" y="${cursor + 20}" fill="#0f766e" font-family="system-ui, sans-serif" font-size="34" font-weight="900">#${item.rank}</text>`,
    );

    item.titleLines.forEach((line, lineIndex) => {
      parts.push(
        `<text x="214" y="${cursor + 8 + lineIndex * 34}" fill="#111827" font-family="system-ui, sans-serif" font-size="30" font-weight="800">${escapeXml(
          line,
        )}</text>`,
      );
    });

    parts.push(
      `<text x="862" y="${cursor + 20}" fill="#334155" font-family="system-ui, sans-serif" font-size="28" font-weight="800" text-anchor="end">${escapeXml(
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
    renderedItems: level.items.map((item) => ({
      ...item,
      titleLines: createTierTitleLines(item.title),
    })),
  }));
  const levelHeights = renderedLevels.map((level) => {
    const rowCount = Math.max(1, Math.ceil(level.renderedItems.length / 4));
    return Math.max(182, 54 + rowCount * 200 + Math.max(0, rowCount - 1) * 18);
  });
  const rowsHeight = levelHeights.reduce((sum, height) => sum + height, 0);
  const height = Math.max(920, 372 + rowsHeight + 96);
  let cursor = 112;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.tierListName,
    )}">`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#f8fafc"/>`,
    `<rect x="48" y="48" width="984" height="${height - 96}" rx="36" fill="#ffffff" stroke="#dbe3ef" stroke-width="2"/>`,
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#64748b" font-family="system-ui, sans-serif" font-size="30" font-weight="700">${escapeXml(
      payload.categoryName,
    )}</text>`,
  ];

  cursor += 76;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#111827" font-family="system-ui, sans-serif" font-size="58" font-weight="800">${escapeXml(
      payload.tierListName,
    )}</text>`,
  );

  cursor += 54;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#0f766e" font-family="system-ui, sans-serif" font-size="34" font-weight="800">${payload.levels.length} 个等级</text>`,
  );

  cursor += 70;

  renderedLevels.forEach((level, index) => {
    const rowHeight = levelHeights[index];
    const rowTop = cursor - 28;
    const fill = index % 2 === 0 ? "#f8fafc" : "#ffffff";
    const labelFill = getTierLabelColor(level.id);

    parts.push(
      `<rect x="88" y="${rowTop}" width="904" height="${rowHeight - 12}" rx="22" fill="${fill}" stroke="#e2e8f0" stroke-width="1"/>`,
      `<rect x="112" y="${cursor - 10}" width="68" height="68" rx="18" fill="${labelFill}"/>`,
      `<text x="146" y="${cursor + 34}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="28" font-weight="900" text-anchor="middle">${escapeXml(
        level.name,
      )}</text>`,
      `<text x="214" y="${cursor + 24}" fill="#111827" font-family="system-ui, sans-serif" font-size="28" font-weight="800">${escapeXml(
        `${level.items.length} 作品`,
      )}</text>`,
    );

    const columns = 4;
    const cardWidth = 166;
    const cardHeight = 200;
    const gapX = 14;
    const gapY = 18;
    const startX = 214;
    const startY = cursor + 46;

    level.renderedItems.forEach((item, itemIndex) => {
      const column = itemIndex % columns;
      const row = Math.floor(itemIndex / columns);
      const x = startX + column * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);

      parts.push(
        `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>`,
        `<rect x="${x + 10}" y="${y + 10}" width="${cardWidth - 20}" height="116" rx="14" fill="#e2e8f0"/>`,
      );

      if (item.coverDataUrl) {
        parts.push(
          `<image href="${escapeXml(item.coverDataUrl)}" x="${x + 10}" y="${y + 10}" width="${cardWidth - 20}" height="116" preserveAspectRatio="xMidYMid slice"/>`,
        );
      } else {
        parts.push(
          `<text x="${x + 20}" y="${y + 74}" fill="#64748b" font-family="system-ui, sans-serif" font-size="22" font-weight="700">${escapeXml(
            item.coverImagePath ? "封面未读取" : "未设置封面",
          )}</text>`,
        );
      }

      item.titleLines.forEach((line, lineIndex) => {
        parts.push(
          `<text x="${x + 14}" y="${y + 154 + lineIndex * 26}" fill="#111827" font-family="system-ui, sans-serif" font-size="22" font-weight="800">${escapeXml(
            line,
          )}</text>`,
        );
      });
    });

    cursor += rowHeight;
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

function createTierTitleLines(value: string): string[] {
  const lines = wrapText(value, 12);

  if (lines.length <= 2) {
    return lines;
  }

  return [lines[0], `${lines[1].slice(0, 9)}...`];
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
      return "#0f766e";
    case "tier-2":
      return "#2563eb";
    case "tier-3":
      return "#7c3aed";
    case "tier-4":
      return "#ea580c";
    case "tier-5":
      return "#b91c1c";
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
